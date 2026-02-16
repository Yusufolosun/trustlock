import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.5.4/index.ts';
import { assertEquals } from 'https://deno.land/std@0.170.0/testing/asserts.ts';

Clarinet.test({
    name: "Factory: Successfully create escrow",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('deployer')!;
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
                    types.uint(100)
                ],
                creator.address
            )
        ]);

        block.receipts[0].result.expectOk().expectUint(0);

        // Verify escrow exists in registry
        let escrowInfo = chain.callReadOnlyFn(
            'trustlock-factory',
            'get-escrow-info',
            [types.uint(0)],
            creator.address
        );

        const info = escrowInfo.result.expectSome().expectTuple();
        assertEquals(info['creator'], creator.address);
        assertEquals(info['buyer'], buyer.address);
        assertEquals(info['seller'], seller.address);
    },
});

Clarinet.test({
    name: "Factory: Track multiple escrows per creator",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('deployer')!;
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
                    types.uint(100)
                ],
                creator.address
            ),
            Tx.contractCall(
                'trustlock-factory',
                'create-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(2000000),
                    types.uint(200)
                ],
                creator.address
            )
        ]);

        // Get creator's escrows
        let creatorEscrows = chain.callReadOnlyFn(
            'trustlock-factory',
            'get-creator-escrows',
            [types.principal(creator.address)],
            creator.address
        );

        const escrows = creatorEscrows.result.expectTuple();
        const ids = escrows['escrow-ids'] as string;

        // Should have 2 escrows
        assertEquals(ids.includes('u0'), true);
        assertEquals(ids.includes('u1'), true);
    },
});

Clarinet.test({
    name: "Factory: Get total escrows count",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('deployer')!;
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
                    types.uint(100)
                ],
                creator.address
            ),
            Tx.contractCall(
                'trustlock-factory',
                'create-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(2000000),
                    types.uint(200)
                ],
                creator.address
            ),
            Tx.contractCall(
                'trustlock-factory',
                'create-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(3000000),
                    types.uint(300)
                ],
                creator.address
            )
        ]);

        let totalEscrows = chain.callReadOnlyFn(
            'trustlock-factory',
            'get-total-escrows',
            [],
            creator.address
        );

        totalEscrows.result.expectOk().expectUint(3);
    },
});

Clarinet.test({
    name: "Factory: Get full escrow details",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('deployer')!;
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
                    types.uint(100)
                ],
                creator.address
            )
        ]);

        // Get full details (registry + state)
        let fullDetails = chain.callReadOnlyFn(
            'trustlock-factory',
            'get-full-escrow-details',
            [types.uint(0)],
            creator.address
        );

        const details = fullDetails.result.expectOk().expectTuple();
        const registry = details['registry'] as any;
        const state = details['state'] as any;

        // Verify both registry and state data present
        assertEquals(registry['creator'], creator.address);
        assertEquals(state['status'], '"CREATED"');
    },
});
