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
