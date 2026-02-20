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

    it("paginates creator escrows beyond page size", () => {
        // PAGE-SIZE is 50 in the contract. Create 52 escrows to trigger page overflow.
        const PAGE_SIZE = 50;
        const total = PAGE_SIZE + 2;

        for (let i = 0; i < total; i++) {
            const { result } = createEscrow(buyer, seller, 1000000 + i, 100);
            expect(result).toBeOk(expect.anything());
        }

        // Page 0 should contain exactly PAGE_SIZE entries
        const page0 = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-creator-escrows-page",
            [Cl.principal(deployer), Cl.uint(0)],
            deployer
        );
        const page0Ids = (page0.result as any).value["escrow-ids"].value;
        expect(page0Ids.length).toBe(PAGE_SIZE);

        // Page 1 should contain the overflow entries (2)
        const page1 = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-creator-escrows-page",
            [Cl.principal(deployer), Cl.uint(1)],
            deployer
        );
        const page1Ids = (page1.result as any).value["escrow-ids"].value;
        expect(page1Ids.length).toBe(total - PAGE_SIZE);

        // Creator info should reflect correct totals
        const info = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-creator-info",
            [Cl.principal(deployer)],
            deployer
        );
        expect(info.result).toBeTuple({
            "total-count": Cl.uint(total),
            "current-page": Cl.uint(1),
        });
    });
});

// ===== BUYER / SELLER LOOKUPS =====

describe("Buyer and Seller Lookups", () => {
    it("tracks escrows by buyer", () => {
        const { id: id1 } = createEscrow(buyer, seller, 1000000, 100);
        const { id: id2 } = createEscrow(buyer, seller, 2000000, 200);

        const buyerEscrows = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-buyer-escrows",
            [Cl.principal(buyer)],
            deployer
        );
        expect(buyerEscrows.result).toBeTuple({
            "escrow-ids": Cl.list([Cl.uint(id1), Cl.uint(id2)]),
        });
    });

    it("tracks escrows by seller", () => {
        const { id: id1 } = createEscrow(buyer, seller, 1000000, 100);
        const { id: id2 } = createEscrow(buyer, seller, 3000000, 300);

        const sellerEscrows = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-seller-escrows",
            [Cl.principal(seller)],
            deployer
        );
        expect(sellerEscrows.result).toBeTuple({
            "escrow-ids": Cl.list([Cl.uint(id1), Cl.uint(id2)]),
        });
    });

    it("returns buyer info with correct totals", () => {
        createEscrow(buyer, seller, 1000000, 100);
        createEscrow(buyer, seller, 2000000, 200);
        createEscrow(buyer, seller, 3000000, 300);

        const info = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-buyer-info",
            [Cl.principal(buyer)],
            deployer
        );
        expect(info.result).toBeTuple({
            "total-count": Cl.uint(3),
            "current-page": Cl.uint(0),
        });
    });

    it("returns seller info with correct totals", () => {
        createEscrow(buyer, seller, 1000000, 100);
        createEscrow(buyer, seller, 2000000, 200);

        const info = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-seller-info",
            [Cl.principal(seller)],
            deployer
        );
        expect(info.result).toBeTuple({
            "total-count": Cl.uint(2),
            "current-page": Cl.uint(0),
        });
    });

    it("returns empty list for buyer with no escrows", () => {
        const unknownUser = accounts.get("wallet_5")!;
        const result = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-buyer-escrows",
            [Cl.principal(unknownUser)],
            deployer
        );
        expect(result.result).toBeTuple({
            "escrow-ids": Cl.list([]),
        });
    });

    it("isolates buyer and seller lists for different principals", () => {
        const buyer2 = accounts.get("wallet_3")!;
        const seller2 = accounts.get("wallet_4")!;

        createEscrow(buyer, seller, 1000000, 100);
        createEscrow(buyer2, seller2, 2000000, 200);

        // buyer should only see their own escrow
        const buyerInfo = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-buyer-info",
            [Cl.principal(buyer)],
            deployer
        );
        expect(buyerInfo.result).toBeTuple({
            "total-count": Cl.uint(1),
            "current-page": Cl.uint(0),
        });

        // seller2 should only see their own escrow
        const seller2Info = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-seller-info",
            [Cl.principal(seller2)],
            deployer
        );
        expect(seller2Info.result).toBeTuple({
            "total-count": Cl.uint(1),
            "current-page": Cl.uint(0),
        });
    });
});
