import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;

describe("Integration Tests", () => {
    it("completes full successful escrow flow via factory", () => {
        const amount = 5000000; // 5 STX

        // Step 1: Create escrow via factory
        const create = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(amount), Cl.uint(100)],
            deployer
        );
        expect(create.result).toBeOk(Cl.uint(0));

        // Step 2: Buyer deposits
        const deposit = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(0)],
            buyer
        );
        expect(deposit.result).toBeOk(Cl.bool(true));

        // Step 3: Seller releases
        const release = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(0)],
            seller
        );
        expect(release.result).toBeOk(Cl.bool(true));

        // Verify final state
        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(0)],
            deployer
        );
        expect(status.result).toBeOk(Cl.stringAscii("RELEASED"));
    });

    it("completes full refund flow via factory", () => {
        const deadlineBlocks = 10;

        // Create and deposit
        simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(3000000), Cl.uint(deadlineBlocks)],
            deployer
        );
        simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(0)],
            buyer
        );

        // Mine past deadline
        simnet.mineEmptyBlocks(deadlineBlocks + 1);

        // Refund
        const refund = simnet.callPublicFn(
            "trustlock-escrow",
            "refund",
            [Cl.uint(0)],
            buyer
        );
        expect(refund.result).toBeOk(Cl.bool(true));

        // Verify final state
        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(0)],
            deployer
        );
        expect(status.result).toBeOk(Cl.stringAscii("REFUNDED"));
    });

    it("handles multiple concurrent escrows with state isolation", () => {
        const buyer2 = accounts.get("wallet_3")!;
        const seller2 = accounts.get("wallet_4")!;

        // Create two escrows
        simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer2), Cl.principal(seller2), Cl.uint(2000000), Cl.uint(200)],
            deployer
        );

        // Deposit to both
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(0)], buyer);
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(1)], buyer2);

        // Release first only
        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(0)], seller);

        // Verify escrow 0 is RELEASED
        const status0 = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(0)],
            deployer
        );
        expect(status0.result).toBeOk(Cl.stringAscii("RELEASED"));

        // Verify escrow 1 is still FUNDED
        const status1 = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(1)],
            deployer
        );
        expect(status1.result).toBeOk(Cl.stringAscii("FUNDED"));
    });
});
