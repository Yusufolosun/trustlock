import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;

describe("Edge Cases", () => {
    it("returns error when querying non-existent escrow", () => {
        const result = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-info",
            [Cl.uint(999)],
            deployer
        );
        expect(result.result).toBeErr(Cl.uint(201));
    });

    it("accepts very large amount for escrow creation", () => {
        const maxAmount = BigInt("340282366920938463463374607431768211455"); // u128 max
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(maxAmount), Cl.uint(100)],
            deployer
        );
        // Should succeed at creation (validation is on deposit, not creation)
        expect(result).toBeOk(Cl.uint(0));
    });

    it("accepts minimum deadline of 1 block", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(1)],
            deployer
        );
        expect(result).toBeOk(expect.anything());
    });

    it("correctly reports is-refundable before and after deadline", () => {
        const deadlineBlocks = 5;

        simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(deadlineBlocks)],
            deployer
        );
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(0)], buyer);

        // Check before deadline - should NOT be refundable
        const before = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "is-refundable",
            [Cl.uint(0)],
            deployer
        );
        expect(before.result).toBeBool(false);

        // Mine past deadline
        simnet.mineEmptyBlocks(deadlineBlocks + 1);

        // Check after deadline - SHOULD be refundable
        const after = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "is-refundable",
            [Cl.uint(0)],
            deployer
        );
        expect(after.result).toBeBool(true);
    });

    it("returns empty list for creator with no escrows", () => {
        const newUser = accounts.get("wallet_5")!;
        const result = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-creator-escrows",
            [Cl.principal(newUser)],
            deployer
        );
        expect(result.result).toBeTuple({
            "escrow-ids": Cl.list([]),
        });
    });
});
