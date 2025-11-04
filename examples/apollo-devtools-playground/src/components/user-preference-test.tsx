import * as React from "react";
import { useApolloClient, gql } from "@apollo/client";
import { Button } from "@fluentui/react-components";

// First query - requests theme and language (will take 3 seconds)
const USER_PREFERENCE_QUERY_1 = gql`
  query UserPreferenceQuery1 {
    userPreference {
      id
      theme
      language
    }
  }
`;

// Second query - requests notifications and privacy (no intersection with first query)
const USER_PREFERENCE_QUERY_2 = gql`
  query UserPreferenceQuery2 {
    userPreference {
      id
      notifications
      privacy
    }
  }
`;

export const UserPreferenceTest: React.FC = () => {
  const client = useApolloClient();
  const [results, setResults] = React.useState<string[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);

  const runTest = async () => {
    setIsRunning(true);
    setResults([]);

    const addResult = (message: string) => {
      setResults((prev) => [
        ...prev,
        `[${new Date().toISOString().split("T")[1]}] ${message}`,
      ]);
    };

    try {
      addResult("Starting test...");
      addResult("Query 1 starting (theme, language) - will take 3s...");

      // Start first query (will take 3 seconds)
      const query1Promise = client.query<{
        userPreference: {
          theme: string;
          language: string;
        };
      }>({
        query: USER_PREFERENCE_QUERY_1,
        fetchPolicy: "cache-only",
      });

      // Wait for first query to complete
      const result1 = await query1Promise;
      addResult(
        `Query 1 completed! Data: ${JSON.stringify(
          result1.data.userPreference,
        )}`,
      );

      addResult("Test completed!");
    } catch (error) {
      addResult(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        margin: "20px",
        backgroundColor: "#f9f9f9",
      }}
    >
      <div
        style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "10px" }}
      >
        User Preference Overlapping Queries Test
      </div>
      <div style={{ marginBottom: "15px", fontSize: "14px", color: "#666" }}>
        This test reproduces the scenario where:
        <ul>
          <li>
            Query 1 starts and requests <code>theme</code> and{" "}
            <code>language</code> (takes 3s)
          </li>
          <li>
            After 1s, Query 2 starts and requests <code>notifications</code> and{" "}
            <code>privacy</code>
          </li>
          <li>
            Both queries request the same root field <code>userPreference</code>{" "}
            but with different fields
          </li>
          <li>
            There is NO field intersection between the queries (except{" "}
            <code>id</code>)
          </li>
        </ul>
        <strong>Expected behavior to test:</strong> Does Query 1 return empty
        data {"{}"} because Query 2 completes first with different fields?
      </div>
      <Button
        style={{ marginBottom: "15px" }}
        appearance="primary"
        onClick={runTest}
        disabled={isRunning}
      >
        {isRunning ? "Running test..." : "Run Overlapping Query Test"}
      </Button>

      {results.length > 0 && (
        <div
          style={{
            marginTop: "15px",
            padding: "10px",
            backgroundColor: "#fff",
            borderRadius: "4px",
            border: "1px solid #ddd",
          }}
        >
          <strong>Results:</strong>
          {results.map((result, index) => (
            <div
              key={index}
              style={{
                marginBottom: "10px",
                padding: "8px",
                backgroundColor: "#f0f0f0",
                borderRadius: "4px",
                fontSize: "12px",
                fontFamily: "monospace",
              }}
            >
              {result}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
