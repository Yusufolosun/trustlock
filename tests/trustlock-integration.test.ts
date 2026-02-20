import { describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;

function createEscrow(
    b: string = buyer,
    s: string = seller,
    amount: number = 5000000,
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

describe("Integration Tests", () => {
    it("completes full successful escrow flow via factory", () => {
        const amount = 5000000;
        const { result: createResult, id } = createEscrow(buyer, seller, amount);
        expect(createResult).toBeOk(Cl.uint(id));

        const deposit = simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id)], buyer);
        expect(deposit.result).toBeOk(Cl.bool(true));

        const release = simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], seller);
        expect(release.result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer,
        );
        expect(status.result).toBeOk(Cl.stringAscii("RELEASED"));
    });

    it("completes full refund flow via factory", () => {
        const deadlineBlocks = 10;
        const { id } = createEscrow(buyer, seller, 3000000, deadlineBlocks);

        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id)], buyer);

        simnet.mineEmptyBlocks(deadlineBlocks + 1);

        const refund = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
        expect(refund.result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer,
        );
        expect(status.result).toBeOk(Cl.stringAscii("REFUNDED"));
    });

    it("handles multiple concurrent escrows with state isolation", () => {
        const buyer2 = accounts.get("wallet_3")!;
        const seller2 = accounts.get("wallet_4")!;

        const { id: id1 } = createEscrow(buyer, seller, 1000000, 100);
        const { id: id2 } = createEscrow(buyer2, seller2, 2000000, 200);

        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id1)], buyer);
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id2)], buyer2);

        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id1)], seller);

        const status1 = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id1)],
            deployer,
        );
        expect(status1.result).toBeOk(Cl.stringAscii("RELEASED"));

        const status2 = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id2)],
            deployer,
        );
        expect(status2.result).toBeOk(Cl.stringAscii("FUNDED"));
    });
});
