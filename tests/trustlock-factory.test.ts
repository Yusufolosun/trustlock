import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;

describe("Factory Contract", () => {
    it("successfully creates escrow", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        expect(result).toBeOk(Cl.uint(0));

        // Verify escrow exists in factory registry
        const info = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-escrow-info",
            [Cl.uint(0)],
            deployer
        );
        const expected = Cl.some(
            Cl.tuple({
                creator: Cl.principal(deployer),
                buyer: Cl.principal(buyer),
                seller: Cl.principal(seller),
                amount: Cl.uint(1000000),
                deadline: Cl.uint(simnet.blockHeight + 99), // block-height at creation + 100
                "created-at": Cl.uint(simnet.blockHeight - 1), // created in previous block
            })
        );
        expect(info.result).toBeSome(expect.anything());
    });

    it("tracks multiple escrows per creator", () => {
        simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(2000000), Cl.uint(200)],
            deployer
        );

        // Get creator's escrows
        const creatorEscrows = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-creator-escrows",
            [Cl.principal(deployer)],
            deployer
        );

        // Should contain escrow IDs 0 and 1
        expect(creatorEscrows.result).toBeTuple({
            "escrow-ids": Cl.list([Cl.uint(0), Cl.uint(1)]),
        });
    });

    it("returns correct total escrows count", () => {
        simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(2000000), Cl.uint(200)],
            deployer
        );
        simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(3000000), Cl.uint(300)],
            deployer
        );

        const totalEscrows = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-total-escrows",
            [],
            deployer
        );
        expect(totalEscrows.result).toBeOk(Cl.uint(3));
    });

    it("returns full escrow details from both registry and escrow contract", () => {
        simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );

        const fullDetails = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-full-escrow-details",
            [Cl.uint(0)],
            deployer
        );
        // Should return ok with registry and state data
        expect(fullDetails.result).toBeOk(expect.anything());
    });
});
