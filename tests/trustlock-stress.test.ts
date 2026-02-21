import { describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;
const buyer2 = accounts.get("wallet_3")!;
const seller2 = accounts.get("wallet_4")!;

/**
 * Create an escrow via the factory and return the contract-assigned ID.
 */
function createEscrow(
    b: string = buyer,
    s: string = seller,
    amount: number | bigint = 1000000,
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

/** Fund an escrow (buyer deposits the required amount). */
function fundEscrow(escrowId: number, b: string = buyer) {
    return simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(escrowId)], b);
}

// ===== BULK CREATION =====

describe("Bulk Escrow Creation", () => {
    it("creates 30 escrows with sequential IDs", () => {
        const count = 30;
        const ids: number[] = [];

        for (let i = 0; i < count; i++) {
            const { result, id } = createEscrow(buyer, seller, 1000000 + i, 100);
            expect(result).toBeOk(Cl.uint(id));
            ids.push(id);
        }

        for (let i = 0; i < count; i++) {
            expect(ids[i]).toBe(i);
        }
    });

    it("factory counter stays accurate after 30 creations", () => {
        const count = 30;
        for (let i = 0; i < count; i++) {
            createEscrow(buyer, seller, 1000000, 100);
        }

        const total = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-total-escrows",
            [],
            deployer,
        );
        expect(total.result).toBeOk(Cl.uint(count));
    });

    it("each escrow holds independent state after bulk creation", () => {
        const count = 10;
        const amounts = [1000000, 2000000, 3000000, 5000000, 8000000];
        const ids: number[] = [];

        for (let i = 0; i < count; i++) {
            const { id } = createEscrow(buyer, seller, amounts[i % amounts.length], 50 + i * 10);
            ids.push(id);
        }

        for (let i = 0; i < count; i++) {
            const info = simnet.callReadOnlyFn(
                "trustlock-escrow",
                "get-info",
                [Cl.uint(ids[i])],
                deployer,
            );
            const data = (info.result as any).value.value;
            expect(data["status"]).toStrictEqual(Cl.stringAscii("CREATED"));
            expect(data["amount"]).toStrictEqual(Cl.uint(amounts[i % amounts.length]));
        }
    });

    it("verifies each of 25 escrows in both factory and escrow contracts", () => {
        const count = 25;
        for (let i = 0; i < count; i++) {
            const { id } = createEscrow(buyer, seller, 1000000 + i * 1000, 100);

            const factoryInfo = simnet.callReadOnlyFn(
                "trustlock-factory",
                "get-escrow-info",
                [Cl.uint(id)],
                deployer,
            );
            expect(factoryInfo.result).toBeSome(expect.anything());

            const escrowInfo = simnet.callReadOnlyFn(
                "trustlock-escrow",
                "get-info",
                [Cl.uint(id)],
                deployer,
            );
            expect(escrowInfo.result).toBeOk(expect.anything());
        }
    });
});

// ===== INTERLEAVED OPERATIONS =====

describe("Interleaved Operations", () => {
    it("handles create-deposit-release interleaved across four escrows", () => {
        const { id: a } = createEscrow(buyer, seller, 1000000, 100);
        const { id: b } = createEscrow(buyer, seller, 2000000, 100);

        fundEscrow(a);

        const { id: c } = createEscrow(buyer, seller, 3000000, 100);

        fundEscrow(b);

        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(a)], seller);

        fundEscrow(c);

        const { id: d } = createEscrow(buyer, seller, 4000000, 100);

        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(b)], seller);

        const statusA = simnet.callReadOnlyFn("trustlock-escrow", "get-status", [Cl.uint(a)], deployer);
        expect(statusA.result).toBeOk(Cl.stringAscii("RELEASED"));

        const statusB = simnet.callReadOnlyFn("trustlock-escrow", "get-status", [Cl.uint(b)], deployer);
        expect(statusB.result).toBeOk(Cl.stringAscii("RELEASED"));

        const statusC = simnet.callReadOnlyFn("trustlock-escrow", "get-status", [Cl.uint(c)], deployer);
        expect(statusC.result).toBeOk(Cl.stringAscii("FUNDED"));

        const statusD = simnet.callReadOnlyFn("trustlock-escrow", "get-status", [Cl.uint(d)], deployer);
        expect(statusD.result).toBeOk(Cl.stringAscii("CREATED"));
    });

    it("handles mixed operations across different wallet pairs", () => {
        const { id: e1 } = createEscrow(buyer, seller, 1000000, 100);
        const { id: e2 } = createEscrow(buyer2, seller2, 2000000, 100);

        fundEscrow(e1, buyer);
        fundEscrow(e2, buyer2);

        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(e2)], seller2);

        const s1 = simnet.callReadOnlyFn("trustlock-escrow", "get-status", [Cl.uint(e1)], deployer);
        expect(s1.result).toBeOk(Cl.stringAscii("FUNDED"));

        const s2 = simnet.callReadOnlyFn("trustlock-escrow", "get-status", [Cl.uint(e2)], deployer);
        expect(s2.result).toBeOk(Cl.stringAscii("RELEASED"));
    });

    it("alternates deposit and release across 10 escrows", () => {
        const count = 10;
        const ids: number[] = [];

        for (let i = 0; i < count; i++) {
            const { id } = createEscrow(buyer, seller, 1000000, 100);
            ids.push(id);
        }

        for (const id of ids) {
            fundEscrow(id);
        }

        // Release only the odd-indexed escrows
        for (let i = 0; i < count; i++) {
            if (i % 2 === 1) {
                simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(ids[i])], seller);
            }
        }

        for (let i = 0; i < count; i++) {
            const status = simnet.callReadOnlyFn(
                "trustlock-escrow",
                "get-status",
                [Cl.uint(ids[i])],
                deployer,
            );
            if (i % 2 === 1) {
                expect(status.result).toBeOk(Cl.stringAscii("RELEASED"));
            } else {
                expect(status.result).toBeOk(Cl.stringAscii("FUNDED"));
            }
        }
    });

    it("create-cancel-create churn keeps counter accurate", () => {
        const { id: a } = createEscrow(buyer, seller, 1000000, 100);
        simnet.callPublicFn("trustlock-escrow", "cancel-escrow", [Cl.uint(a)], buyer);

        const { id: b } = createEscrow(buyer, seller, 2000000, 100);
        const { id: c } = createEscrow(buyer, seller, 3000000, 100);
        simnet.callPublicFn("trustlock-escrow", "cancel-escrow", [Cl.uint(c)], buyer);

        createEscrow(buyer, seller, 4000000, 100);

        const total = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-total-escrows",
            [],
            deployer,
        );
        expect(total.result).toBeOk(Cl.uint(4));

        const statusA = simnet.callReadOnlyFn("trustlock-escrow", "get-status", [Cl.uint(a)], deployer);
        expect(statusA.result).toBeOk(Cl.stringAscii("CANCELLED"));

        const statusB = simnet.callReadOnlyFn("trustlock-escrow", "get-status", [Cl.uint(b)], deployer);
        expect(statusB.result).toBeOk(Cl.stringAscii("CREATED"));
    });
});

// ===== CONCURRENT LIFECYCLE =====

describe("Concurrent Lifecycle", () => {
    it("completes 5 full release cycles back-to-back", () => {
        for (let i = 0; i < 5; i++) {
            const amount = 1000000 * (i + 1);
            const { id } = createEscrow(buyer, seller, amount, 100);
            fundEscrow(id);

            const rel = simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], seller);
            expect(rel.result).toBeOk(Cl.bool(true));

            const status = simnet.callReadOnlyFn(
                "trustlock-escrow",
                "get-status",
                [Cl.uint(id)],
                deployer,
            );
            expect(status.result).toBeOk(Cl.stringAscii("RELEASED"));
        }
    });

    it("completes 5 full refund cycles back-to-back", () => {
        for (let i = 0; i < 5; i++) {
            const deadline = 3;
            const { id } = createEscrow(buyer, seller, 1000000 * (i + 1), deadline);
            fundEscrow(id);
            simnet.mineEmptyBlocks(deadline + 1);

            const ref = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
            expect(ref.result).toBeOk(Cl.bool(true));

            const status = simnet.callReadOnlyFn(
                "trustlock-escrow",
                "get-status",
                [Cl.uint(id)],
                deployer,
            );
            expect(status.result).toBeOk(Cl.stringAscii("REFUNDED"));
        }
    });

    it("mixes release and refund across different wallet pairs", () => {
        // Pair 1: buyer/seller → release
        const { id: e1 } = createEscrow(buyer, seller, 1000000, 100);
        fundEscrow(e1, buyer);

        // Pair 2: buyer2/seller2 → refund
        const { id: e2 } = createEscrow(buyer2, seller2, 2000000, 3);
        fundEscrow(e2, buyer2);

        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(e1)], seller);

        simnet.mineEmptyBlocks(5);
        simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(e2)], buyer2);

        const s1 = simnet.callReadOnlyFn("trustlock-escrow", "get-status", [Cl.uint(e1)], deployer);
        expect(s1.result).toBeOk(Cl.stringAscii("RELEASED"));

        const s2 = simnet.callReadOnlyFn("trustlock-escrow", "get-status", [Cl.uint(e2)], deployer);
        expect(s2.result).toBeOk(Cl.stringAscii("REFUNDED"));
    });
});

// ===== CREATOR LIST SCALING =====

describe("Creator List Scaling", () => {
    it("tracks creator list accurately through 20 escrows", () => {
        for (let i = 0; i < 20; i++) {
            createEscrow(buyer, seller, 1000000, 100);
        }

        const creatorInfo = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-creator-info",
            [Cl.principal(deployer)],
            deployer,
        );
        expect(creatorInfo.result).toBeTuple({
            "total-count": Cl.uint(20),
            "current-page": Cl.uint(0),
        });
    });

    it("buyer and seller lists scale independently", () => {
        for (let i = 0; i < 15; i++) {
            createEscrow(buyer, seller, 1000000, 100);
        }

        const buyerInfo = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-buyer-info",
            [Cl.principal(buyer)],
            deployer,
        );
        expect(buyerInfo.result).toBeTuple({
            "total-count": Cl.uint(15),
            "current-page": Cl.uint(0),
        });

        const sellerInfo = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-seller-info",
            [Cl.principal(seller)],
            deployer,
        );
        expect(sellerInfo.result).toBeTuple({
            "total-count": Cl.uint(15),
            "current-page": Cl.uint(0),
        });
    });
});

// ===== MULTI-CREATOR STRESS =====

describe("Multi-Creator Stress", () => {
    it("multiple creators can create escrows without conflict", () => {
        const creators = [deployer, buyer, seller];
        const ids: number[] = [];

        for (const creator of creators) {
            for (let i = 0; i < 5; i++) {
                const { result, id } = createEscrow(buyer2, seller2, 1000000, 100, creator);
                expect(result).toBeOk(Cl.uint(id));
                ids.push(id);
            }
        }

        // 15 total escrows across 3 creators
        expect(ids.length).toBe(15);

        const total = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-total-escrows",
            [],
            deployer,
        );
        expect(total.result).toBeOk(Cl.uint(15));
    });

    it("creator lists stay isolated between different principals", () => {
        // deployer creates 3
        for (let i = 0; i < 3; i++) {
            createEscrow(buyer, seller, 1000000, 100, deployer);
        }
        // buyer creates 2
        for (let i = 0; i < 2; i++) {
            createEscrow(buyer2, seller2, 1000000, 100, buyer);
        }

        const deployerInfo = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-creator-info",
            [Cl.principal(deployer)],
            deployer,
        );
        expect(deployerInfo.result).toBeTuple({
            "total-count": Cl.uint(3),
            "current-page": Cl.uint(0),
        });

        const buyerInfo = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-creator-info",
            [Cl.principal(buyer)],
            deployer,
        );
        expect(buyerInfo.result).toBeTuple({
            "total-count": Cl.uint(2),
            "current-page": Cl.uint(0),
        });
    });
});
