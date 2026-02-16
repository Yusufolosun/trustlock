import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.5.4/index.ts';
import { assertEquals } from 'https://deno.land/std@0.170.0/testing/asserts.ts';

// ========================================
// INITIALIZATION TESTS
// ========================================

Clarinet.test({
    name: "Escrow: Successfully initialize escrow",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'initialize-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(1000000), // 1 STX
                    types.uint(100) // 100 blocks
                ],
                deployer.address
            )
        ]);

        block.receipts[0].result.expectOk().expectUint(0); // First escrow ID is 0

        // Verify escrow was created
        let escrowInfo = chain.callReadOnlyFn(
            'trustlock-escrow',
            'get-info',
            [types.uint(0)],
            deployer.address
        );

        const info = escrowInfo.result.expectOk().expectTuple();
        assertEquals(info['buyer'], buyer.address);
        assertEquals(info['seller'], seller.address);
        assertEquals(info['status'], '"CREATED"');
    },
});

Clarinet.test({
    name: "Escrow: Reject zero amount",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'initialize-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(0), // Zero amount
                    types.uint(100)
                ],
                deployer.address
            )
        ]);

        block.receipts[0].result.expectErr().expectUint(300); // ERR-INVALID-AMOUNT
    },
});

Clarinet.test({
    name: "Escrow: Reject same buyer and seller",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'initialize-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(buyer.address), // Same as buyer
                    types.uint(1000000),
                    types.uint(100)
                ],
                deployer.address
            )
        ]);

        block.receipts[0].result.expectErr().expectUint(103); // ERR-UNAUTHORIZED
    },
});
