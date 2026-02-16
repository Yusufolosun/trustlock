import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.5.4/index.ts';
import { assertEquals } from 'https://deno.land/std@0.170.0/testing/asserts.ts';

Clarinet.test({
    name: "Edge: Query non-existent escrow",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;

        let result = chain.callReadOnlyFn(
            'trustlock-escrow',
            'get-info',
            [types.uint(999)],
            deployer.address
        );

        result.result.expectErr().expectUint(201); // ERR-NOT-FUNDED
    },
});

Clarinet.test({
    name: "Edge: Very large amount escrow",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;
        const maxAmount = "340282366920938463463374607431768211455"; // u128 max

        let block = chain.mineBlock([
            Tx.contractCall(
                'trustlock-factory',
                'create-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(maxAmount),
                    types.uint(100)
                ],
                deployer.address
            )
        ]);

        // Should succeed (validation is on deposit, not creation)
        block.receipts[0].result.expectOk();
    },
});

Clarinet.test({
    name: "Edge: Minimum deadline (1 block)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'trustlock-factory',
                'create-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(1000000),
                    types.uint(1) // 1 block deadline
                ],
                deployer.address
            )
        ]);

        block.receipts[0].result.expectOk();
    },
});

Clarinet.test({
    name: "Edge: Check is-refundable before and after deadline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;
        const deadlineBlocks = 5;

        let setupBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-factory',
                'create-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(1000000),
                    types.uint(deadlineBlocks)
                ],
                deployer.address
            ),
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                buyer.address
            )
        ]);

        // Check before deadline
        let beforeDeadline = chain.callReadOnlyFn(
            'trustlock-escrow',
            'is-refundable',
            [types.uint(0)],
            deployer.address
        );
        assertEquals(beforeDeadline.result, "false");

        // Mine past deadline
        chain.mineEmptyBlockUntil(chain.blockHeight + deadlineBlocks + 1);

        // Check after deadline
        let afterDeadline = chain.callReadOnlyFn(
            'trustlock-escrow',
            'is-refundable',
            [types.uint(0)],
            deployer.address
        );
        assertEquals(afterDeadline.result, "true");
    },
});

Clarinet.test({
    name: "Edge: Empty creator escrows list",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const newUser = accounts.get('wallet_5')!;

        let result = chain.callReadOnlyFn(
            'trustlock-factory',
            'get-creator-escrows',
            [types.principal(newUser.address)],
            deployer.address
        );

        const escrows = result.result.expectTuple();
        assertEquals(escrows['escrow-ids'], "(list)");
    },
});
