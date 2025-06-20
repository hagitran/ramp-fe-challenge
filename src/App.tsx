import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { InputSelect } from "./components/InputSelect"
import { Instructions } from "./components/Instructions"
import { Transactions } from "./components/Transactions"
import { useEmployees } from "./hooks/useEmployees"
import { usePaginatedTransactions } from "./hooks/usePaginatedTransactions"
import { useTransactionsByEmployee } from "./hooks/useTransactionsByEmployee"
import { EMPTY_EMPLOYEE } from "./utils/constants"
import { Employee, Transaction } from "./utils/types"
import { useCustomFetch } from "./hooks/useCustomFetch"
import { SetTransactionApprovalParams } from "./utils/types"

export function App() {
  const { data: employees, ...employeeUtils } = useEmployees()
  const { data: paginatedTransactions, ...paginatedTransactionsUtils } = usePaginatedTransactions()
  const { data: transactionsByEmployee, ...transactionsByEmployeeUtils } = useTransactionsByEmployee()
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const { fetchWithoutCache } = useCustomFetch();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Load all transactions on mount or when employees are loaded
  const loadAllTransactions = useCallback(async () => {
    await employeeUtils.fetchAll()
    await paginatedTransactionsUtils.fetchAll()
  }, [employeeUtils, paginatedTransactionsUtils])

  // Load more transactions (pagination)
  const handleViewMore = async () => {
    await paginatedTransactionsUtils.fetchAll();
  };

  // Approve/unapprove transaction and persist in allTransactions
  const setTransactionApproval = async ({ transactionId, newValue }: { transactionId: string, newValue: boolean }) => {
    await fetchWithoutCache<void, SetTransactionApprovalParams>("setTransactionApproval", {
      transactionId,
      value: newValue,
    });
    setAllTransactions((prev: Transaction[]) =>
      prev.map((t) =>
        t.id === transactionId ? { ...t, approved: newValue } : t
      )
    );
  };

  // Filter transactions by selected employee or show all
  const transactions = useMemo(() => {
    if (selectedEmployee && selectedEmployee.id && transactionsByEmployee) {
      return transactionsByEmployee;
    }
    return allTransactions;
  }, [allTransactions, selectedEmployee, transactionsByEmployee]);

  // Initial load
  useEffect(() => {
    if (employees === null && !employeeUtils.loading) {
      loadAllTransactions()
    }
  }, [employeeUtils.loading, employees, loadAllTransactions])

  useEffect(() => {
    if (paginatedTransactions?.data) {
      setAllTransactions((prev: Transaction[]) => {
        // Avoid duplicates
        const prevIds = new Set(prev.map((t) => t.id));
        const newOnes = (paginatedTransactions.data as Transaction[]).filter((t) => !prevIds.has(t.id));
        // If prev is empty, just use the new data (for initial load)
        if (prev.length === 0) return paginatedTransactions.data as Transaction[];
        return [...prev, ...newOnes];
      });
    }
  }, [paginatedTransactions]);

  return (
    <Fragment>
      <main className="MainContainer">
        <Instructions />
        <hr className="RampBreak--l" />
        <InputSelect<Employee>
          isLoading={false}
          defaultValue={EMPTY_EMPLOYEE}
          items={employees === null ? [] : [EMPTY_EMPLOYEE, ...employees]}
          label="Filter by employee"
          loadingLabel="Loading employees"
          parseItem={(item) => {
            if (item === EMPTY_EMPLOYEE) {
              return {
                value: "",
                label: `All Employees`,
              }
            }
            return {
              value: item.id,
              label: `${item.firstName} ${item.lastName}`,
            }
          }}
          onChange={async (newValue) => {
            if (newValue === null || newValue === EMPTY_EMPLOYEE || newValue.id === EMPTY_EMPLOYEE.id) {
              setSelectedEmployee(null);
              await loadAllTransactions();
              return;
            }
            setSelectedEmployee(newValue);
            await transactionsByEmployeeUtils.fetchById(newValue.id);
          }}
        />
        <div className="RampBreak--l" />
        <div className="RampGrid">
          <Transactions transactions={transactions} setTransactionApproval={setTransactionApproval} />
          {(!selectedEmployee && transactions.length > 0 && paginatedTransactions?.data?.length === 5) && (
            <button
              className="RampButton"
              disabled={paginatedTransactionsUtils.loading}
              onClick={handleViewMore}
            >
              View More
            </button>
          )}
        </div>
      </main>
    </Fragment>
  )
}
