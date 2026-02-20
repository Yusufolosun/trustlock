import { describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;

function createEscrow(
    b: string = buyer,
    s: string = seller,
    amount: number = 1000000,
    deadlineBlocks: number = 100,
    sender: string = deployer
): { result: any; id: number } {
    const { result } = simnet.callPublicFn(
        "trustlock-factory",
        "create-escrow",
        [Cl.principal(b), Cl.principal(s), Cl.uint(amount), Cl.uint(deadlineBlocks)],
        sender
    );
    let id = -1;
    if (result.type === ClarityType.ResponseOk) {
        id = Number(result.value.value);
    }
    return { result, id };
}

describe("Factory Contract", () => {
    it("successfully creates escrow", () => {
        const { result, id } = createEscrow();
        expect(result).toBeOk(Cl.uint(id));

        const info = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-escrow-info",
            [Cl.uint(id)],
            deployer
        );
        expect(info.result).toBeSome(expect.anything());
    });

    it("tracks multiple escrows per creator", () => {
        const { id: id1 } = createEscrow();
        const { id: id2 } = createEscrow(buyer, seller, 2000000, 200);

        const creatorEscrows = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-creator-escrows",
            [Cl.principal(deployer)],
            deployer
        );

        expect(creatorEscrows.result).toBeTuple({
            "escrow-ids": Cl.list([Cl.uint(id1), Cl.uint(id2)]),
        });
    });

    it("returns correct total escrows count", () => {
        createEscrow();
        createEscrow(buyer, seller, 2000000, 200);
        createEscrow(buyer, seller, 3000000, 300);

        const totalEscrows = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-total-escrows",
            [],
            deployer
        );
        expect(totalEscrows.result).toBeOk(Cl.uint(3));
    });

    it("returns full escrow details from both registry and escrow contract", () => {
        const { id } = createEscrow();

        const fullDetails = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-full-escrow-details",
            [Cl.uint(id)],
            deployer
        );
        expect(fullDetails.result).toBeOk(expect.anything());
    });
});
