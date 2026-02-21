import { describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;
const attacker = accounts.get("wallet_3")!;

/**
 * Helper — create an escrow through the factory so we can exercise
 * error codes that only fire during real contract interactions.
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

// ===== DEPLOYMENT =====

describe("Traits Contract Deployment", () => {
    it("deploys to simnet without compilation errors", () => {
        // If any constant or trait definition had a syntax issue the
        // entire simnet boot would fail — blockHeight > 0 proves it loaded.
        expect(simnet.blockHeight).toBeGreaterThan(0);
    });

    it("is recognized as a deployed contract by simnet", () => {
        const source = simnet.getContractSource("trustlock-traits");
        expect(source).toBeDefined();
        expect(source!.length).toBeGreaterThan(0);
    });
});
