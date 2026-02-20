import { describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;

function createEscrow(
    b: string = buyer,
    s: string = seller,
    amount: bigint | number = 1000000,
    deadlineBlocks: number = 100,
    sender: string = deployer,
): { result: any; id: number } {
    const { result } = simnet.callPublicFn(
        "trustlock-factory",
        "create-escrow",
        [Cl.principal(b), Cl.principal(s), Cl.uint(amount), Cl.uint(deadlineBlocks)],
        sender,
    );
    let id = -1;
    if (result.type === ClarityType.ResponseOk) {
        id = Number(result.value.value);
    }
    return { result, id };
}

describe("Edge Cases", () => {
    it("returns error when querying non-existent escrow", () => {
        const result = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-info",
            [Cl.uint(999)],
            deployer,
        );
        expect(result.result).toBeErr(Cl.uint(201));
    });

    it("accepts very large amount for escrow creation", () => {
        const maxAmount = BigInt("340282366920938463463374607431768211455");
        const { result, id } = createEscrow(buyer, seller, maxAmount);
        expect(result).toBeOk(Cl.uint(id));
    });

    it("accepts minimum deadline of 1 block", () => {
        const { result } = createEscrow(buyer, seller, 1000000, 1);
        expect(result).toBeOk(expect.anything());
    });

    it("correctly reports is-refundable before and after deadline", () => {
        const deadlineBlocks = 5;
        const { id } = createEscrow(buyer, seller, 1000000, deadlineBlocks);
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id)], buyer);

        const before = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "is-refundable",
            [Cl.uint(id)],
            deployer,
        );
        expect(before.result).toBeBool(false);

        simnet.mineEmptyBlocks(deadlineBlocks + 1);

        const after = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "is-refundable",
            [Cl.uint(id)],
            deployer,
        );
        expect(after.result).toBeBool(true);
    });

    it("returns empty list for creator with no escrows", () => {
        const newUser = accounts.get("wallet_5")!;
        const result = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-creator-escrows",
            [Cl.principal(newUser)],
            deployer,
        );
        expect(result.result).toBeTuple({
            "escrow-ids": Cl.list([]),
        });
    });

    // ===== AMOUNT & DEADLINE BOUNDS =====

    it("rejects escrow with amount below MIN-ESCROW-AMOUNT (u1000)", () => {
        const { result } = createEscrow(buyer, seller, 999);
        expect(result).toBeErr(Cl.uint(304)); // ERR-AMOUNT-TOO-LOW
    });

    it("accepts escrow at exactly MIN-ESCROW-AMOUNT", () => {
        const { result, id } = createEscrow(buyer, seller, 1000);
        expect(result).toBeOk(Cl.uint(id));
    });

    it("rejects escrow with deadline exceeding MAX-DEADLINE-BLOCKS (u52560)", () => {
        const { result } = createEscrow(buyer, seller, 1000000, 52561);
        expect(result).toBeErr(Cl.uint(305)); // ERR-DEADLINE-TOO-LONG
    });

    it("accepts escrow at exactly MAX-DEADLINE-BLOCKS", () => {
        const { result, id } = createEscrow(buyer, seller, 1000000, 52560);
        expect(result).toBeOk(Cl.uint(id));
    });
});
