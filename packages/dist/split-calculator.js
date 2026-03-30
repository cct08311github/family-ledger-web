/**
 * Split Calculator - Shared Domain Logic
 *
 * Handles expense splitting and debt simplification.
 * Platform-agnostic: no Firebase or platform-specific dependencies.
 */
/**
 * Calculate equal split for an expense
 */
export function calculateEqualSplit(amount, payerId, participants) {
    const perPerson = amount / participants.length;
    const rounded = Math.round(perPerson);
    const remainder = amount - rounded * participants.length;
    return participants.map((member, index) => ({
        memberId: member.id,
        memberName: member.name,
        shareAmount: index === participants.length - 1 ? rounded + remainder : rounded,
        paidAmount: member.id === payerId ? amount : 0,
        isParticipant: true,
    }));
}
/**
 * Calculate percentage-based split
 */
export function calculatePercentageSplit(amount, payerId, percentages, memberNames) {
    const entries = Object.entries(percentages);
    const shares = entries.map(([_, pct]) => Math.round((amount * pct) / 100));
    const totalShares = shares.reduce((a, b) => a + b, 0);
    const remainder = amount - totalShares;
    if (remainder !== 0 && shares.length > 0) {
        shares[shares.length - 1] += remainder;
    }
    return entries.map(([memberId, _], index) => ({
        memberId,
        memberName: memberNames[memberId] ?? '',
        shareAmount: shares[index],
        paidAmount: memberId === payerId ? amount : 0,
        isParticipant: true,
    }));
}
/**
 * Calculate custom amount split
 */
export function calculateCustomSplit(amount, payerId, customAmounts, memberNames) {
    return Object.entries(customAmounts).map(([memberId, share]) => ({
        memberId,
        memberName: memberNames[memberId] ?? '',
        shareAmount: share,
        paidAmount: memberId === payerId ? amount : 0,
        isParticipant: true,
    }));
}
/**
 * Calculate net balances for all members
 *
 * Positive balance = others owe this member
 * Negative balance = this member owes others
 */
export function calculateNetBalances(expenses, settlements) {
    const balances = {};
    // Process all shared expenses
    for (const expense of expenses) {
        if (!expense.isShared)
            continue;
        for (const split of expense.splits) {
            if (!split.isParticipant)
                continue;
            // shareAmount - paidAmount = net debt
            const debt = split.shareAmount - split.paidAmount;
            balances[split.memberId] = (balances[split.memberId] ?? 0) - debt;
        }
    }
    // Apply settlements
    for (const settlement of settlements) {
        balances[settlement.fromMemberId] = (balances[settlement.fromMemberId] ?? 0) - settlement.amount;
        balances[settlement.toMemberId] = (balances[settlement.toMemberId] ?? 0) + settlement.amount;
    }
    return balances;
}
/**
 * Simplify debts using greedy algorithm (minimum cash flow)
 *
 * Returns the minimum number of transactions needed to settle all debts.
 */
export function simplifyDebts(expenses, settlements, nameMap) {
    const balances = calculateNetBalances(expenses, settlements);
    // Separate into creditors (positive = owed) and debtors (negative = owes)
    const creditors = [];
    const debtors = [];
    for (const [id, amount] of Object.entries(balances)) {
        const rounded = Math.round(amount);
        if (rounded > 0)
            creditors.push({ id, amount: rounded });
        if (rounded < 0)
            debtors.push({ id, amount: -rounded });
    }
    // Sort by amount descending
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);
    const result = [];
    let ci = 0;
    let di = 0;
    while (ci < creditors.length && di < debtors.length) {
        const creditor = creditors[ci];
        const debtor = debtors[di];
        const settleAmount = Math.min(creditor.amount, debtor.amount);
        if (settleAmount > 0) {
            result.push({
                from: debtor.id,
                fromName: nameMap[debtor.id] ?? debtor.id,
                to: creditor.id,
                toName: nameMap[creditor.id] ?? creditor.id,
                amount: settleAmount,
            });
        }
        creditor.amount -= settleAmount;
        debtor.amount -= settleAmount;
        if (Math.round(creditor.amount) <= 0)
            ci++;
        if (Math.round(debtor.amount) <= 0)
            di++;
    }
    return result;
}
