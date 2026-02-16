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

// ========================================
// DEPOSIT TESTS
// ========================================

Clarinet.test({
    name: "Escrow: Successful deposit by buyer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;
        const amount = 1000000;

        let block = chain.mineBlock([
            // Initialize escrow
            Tx.contractCall(
                'trustlock-escrow',
                'initialize-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(amount),
                    types.uint(100)
                ],
                deployer.address
            ),
            // Buyer deposits
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                buyer.address
            )
        ]);

        block.receipts[1].result.expectOk().expectBool(true);

        // Verify status changed to FUNDED
        let escrowInfo = chain.callReadOnlyFn(
            'trustlock-escrow',
            'get-status',
            [types.uint(0)],
            deployer.address
        );

        assertEquals(escrowInfo.result.expectOk(), '"FUNDED"');
    },
});

Clarinet.test({
    name: "Escrow: Reject deposit from non-buyer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;
        const attacker = accounts.get('wallet_3')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'initialize-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(1000000),
                    types.uint(100)
                ],
                deployer.address
            ),
            // Attacker tries to deposit
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                attacker.address
            )
        ]);

        block.receipts[1].result.expectErr().expectUint(100); // ERR-NOT-BUYER
    },
});

Clarinet.test({
    name: "Escrow: Reject double deposit",
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
                    types.uint(1000000),
                    types.uint(100)
                ],
                deployer.address
            ),
            // First deposit
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                buyer.address
            ),
            // Second deposit attempt
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                buyer.address
            )
        ]);

        block.receipts[2].result.expectErr().expectUint(200); // ERR-ALREADY-FUNDED
    },
});

// ========================================
// RELEASE TESTS
// ========================================

Clarinet.test({
    name: "Escrow: Successful release by seller",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;
        const amount = 1000000;

        let block = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'initialize-escrow',
                [
                    types.principal(buyer.address),
                    types.principal(seller.address),
                    types.uint(amount),
                    types.uint(100)
                ],
                deployer.address
            ),
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                buyer.address
            ),
            // Seller releases funds
            Tx.contractCall(
                'trustlock-escrow',
                'release',
                [types.uint(0)],
                seller.address
            )
        ]);

        block.receipts[2].result.expectOk().expectBool(true);

        // Verify status is RELEASED
        let escrowInfo = chain.callReadOnlyFn(
            'trustlock-escrow',
            'get-status',
            [types.uint(0)],
            deployer.address
        );

        assertEquals(escrowInfo.result.expectOk(), '"RELEASED"');
    },
});

Clarinet.test({
    name: "Escrow: Reject release from non-seller",
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
                    types.uint(1000000),
                    types.uint(100)
                ],
                deployer.address
            ),
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                buyer.address
            ),
            // Buyer tries to release (should fail)
            Tx.contractCall(
                'trustlock-escrow',
                'release',
                [types.uint(0)],
                buyer.address
            )
        ]);

        block.receipts[2].result.expectErr().expectUint(101); // ERR-NOT-SELLER
    },
});

Clarinet.test({
    name: "Escrow: Reject release before funding",
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
                    types.uint(1000000),
                    types.uint(100)
                ],
                deployer.address
            ),
            // Try to release before deposit
            Tx.contractCall(
                'trustlock-escrow',
                'release',
                [types.uint(0)],
                seller.address
            )
        ]);

        block.receipts[1].result.expectErr().expectUint(201); // ERR-NOT-FUNDED
    },
});

// ========================================
// REFUND TESTS
// ========================================

Clarinet.test({
    name: "Escrow: Successful refund after deadline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;
        const deadlineBlocks = 10;

        let block = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'initialize-escrow',
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

        // Mine blocks to pass deadline
        chain.mineEmptyBlockUntil(chain.blockHeight + deadlineBlocks + 1);

        // Now refund should succeed
        let refundBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'refund',
                [types.uint(0)],
                buyer.address
            )
        ]);

        refundBlock.receipts[0].result.expectOk().expectBool(true);

        // Verify status is REFUNDED
        let escrowInfo = chain.callReadOnlyFn(
            'trustlock-escrow',
            'get-status',
            [types.uint(0)],
            deployer.address
        );

        assertEquals(escrowInfo.result.expectOk(), '"REFUNDED"');
    },
});

Clarinet.test({
    name: "Escrow: Reject refund before deadline",
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
                    types.uint(1000000),
                    types.uint(100)
                ],
                deployer.address
            ),
            Tx.contractCall(
                'trustlock-escrow',
                'deposit',
                [types.uint(0)],
                buyer.address
            ),
            // Try to refund immediately
            Tx.contractCall(
                'trustlock-escrow',
                'refund',
                [types.uint(0)],
                buyer.address
            )
        ]);

        block.receipts[2].result.expectErr().expectUint(302); // ERR-DEADLINE-NOT-REACHED
    },
});

Clarinet.test({
    name: "Escrow: Permissionless refund works",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const buyer = accounts.get('wallet_1')!;
        const seller = accounts.get('wallet_2')!;
        const thirdParty = accounts.get('wallet_3')!;
        const deadlineBlocks = 10;

        let block = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'initialize-escrow',
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

        // Mine blocks to pass deadline
        chain.mineEmptyBlockUntil(chain.blockHeight + deadlineBlocks + 1);

        // Third party triggers refund
        let refundBlock = chain.mineBlock([
            Tx.contractCall(
                'trustlock-escrow',
                'refund',
                [types.uint(0)],
                thirdParty.address
            )
        ]);

        refundBlock.receipts[0].result.expectOk().expectBool(true);
    },
});



