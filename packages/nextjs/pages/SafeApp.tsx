import * as React from "react";
import type { NextPage } from "next";
import { useDebounce } from "use-debounce";
import { parseEther } from "viem";
import { usePrepareSendTransaction, useSendTransaction, useWaitForTransaction } from "wagmi";
import { MetaHeader } from "~~/components/MetaHeader";

const SafeApp: NextPage = () => {
  const [to, setTo] = React.useState("");
  const [debouncedTo] = useDebounce(to, 500);

  const [amount, setAmount] = React.useState("");
  const [debouncedAmount] = useDebounce(amount, 500);

  const { config } = usePrepareSendTransaction({
    to: debouncedTo,
    value: debouncedAmount ? parseEther(debouncedAmount) : undefined,
  });
  const { data, sendTransaction } = useSendTransaction(config);

  const { isLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });
  return (
    <>
      <MetaHeader />
      <div className="flex flex-col items-center justify-center min-h-screen ">
        <form
          className="p-6 space-y-6  rounded shadow-md"
          onSubmit={e => {
            e.preventDefault();
            sendTransaction?.();
          }}
        >
          <input
            className="w-full p-2  rounded input"
            aria-label="Recipient"
            onChange={e => setTo(e.target.value)}
            placeholder="0xA0Cf…251e"
            value={to}
          />
          <input
            className="w-full p-2 rounded input"
            aria-label="Amount (ether)"
            onChange={e => setAmount(e.target.value)}
            placeholder="0.05"
            value={amount}
          />
          <button
            className={`w-full p-2  bg-blue-500 rounded btn btn-primary ${
              isLoading || !sendTransaction || !to || !amount ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-600"
            }`}
            type="submit"
            // disabled={isLoading || !sendTransaction || !to || !amount}
          >
            {isLoading ? "Sending..." : "Send"}
          </button>

          {isSuccess && (
            <div className="text-green-500">
              Successfully sent {amount} ether to {to}
              <div>
                <a className="text-blue-500 underline" href={`https://etherscan.io/tx/${data?.hash}`}>
                  Etherscan
                </a>
              </div>
            </div>
          )}
        </form>
      </div>
    </>
  );
};

export default SafeApp;
