import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.5.4/index.ts';
import { assertEquals } from 'https://deno.land/std@0.170.0/testing/asserts.ts';

Clarinet.test({
    name: "Integration: Full successful escrow flow via factory",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;
        const amount = 5000000; // 5 STX

        // Step 1: Create escrow via factory
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-factory',
                'create-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(amount),
                    types.uint(100)
                ],
                creator.address
            )
        ]);

        createBlock.receipts[0].result.expectOk().expectUint(0);

        // Step 2: Buyer deposits
        let depositBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                buyer.address
            )
        ]);

        depositBlock.receipts[0].result.expectOk().expectBool(true);

        // Step 3: Seller releases
        let releaseBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'release',
                [types.uint(0)],
                seller.address
            )
        ]);

        releaseBlock.receipts[0].result.expectOk().expectBool(true);

        // Verify final state
        let finalStatus = chain.callReadOnlyFn(
            'trustlock-escrow',
            'get-status',
            [types.uint(0)],
            creator.address
        );

        assertEquals(finalStatus.result.expectOk(), '"RELEASED"');
    },
});

Clarinet.test({
    name: "Integration: Full refund flow via factory",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;
        const deadlineBlocks = 10;

        // Create and deposit
        let setupBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-factory',
                'create-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(3000000),
                    types.uint(deadlineBlocks)
                ],
                creator.address
            ),
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                buyer.address
            )
        ]);

        // Mine past deadline
        chain.mineEmptyBlockUntil(chain.blockHeight + deadlineBlocks + 1);

        // Refund
        let refundBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'refund',
                [types.uint(0)],
                buyer.address
            )
        ]);

        refundBlock.receipts[0].result.expectOk().expectBool(true);

        // Verify final state
        let finalStatus = chain.callReadOnlyFn(
            'trustlock-escrow',
            'get-status',
            [types.uint(0)],
            creator.address
        );

        assertEquals(finalStatus.result.expectOk(), '"REFUNDED"');
    },
});

Clarinet.test({
    name: "Integration: Multiple concurrent escrows",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('deployer')!;
        const buyer1 = accounts.get('wallet_1')!;
        const seller1 = accounts.get('wallet_2')!;
        const buyer2 = accounts.get('wallet_3')!;
        const seller2 = accounts.get('wallet_4')!;

        // Create two escrows
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-factory',
                'create-escrow',
                [
                    types.principal(buyer1.address),
                    types.principal(seller1.address),
                    types.uint(1000000),
                    types.uint(100)
                ],
                creator.address
            ),
            Tx.contractCall(
                'trustlock-factory',
                'create-escrow',
                [
                    types.principal(buyer2.address),
                    types.principal(seller2.address),
                    types.uint(2000000),
                    types.uint(200)
                ],
                creator.address
            )
        ]);

        // Deposit to both
        let depositBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                buyer1.address
            ),
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(1)],
                buyer2.address
            )
        ]);

        // Release first, let second timeout
        let releaseBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'release',
                [types.uint(0)],
                seller1.address
            )
        ]);

        // Verify escrow 0 is RELEASED
        let status0 = chain.callReadOnlyFn(
            'trustlock-escrow',
            'get-status',
            [types.uint(0)],
            creator.address
        );
        assertEquals(status0.result.expectOk(), '"RELEASED"');

        // Verify escrow 1 is still FUNDED
        let status1 = chain.callReadOnlyFn(
            'trustlock-escrow',
            'get-status',
            [types.uint(1)],
            creator.address
        );
        assertEquals(status1.result.expectOk(), '"FUNDED"');
    },
});
