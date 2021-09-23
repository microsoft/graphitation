import React from "react";
import { useLazyLoadQuery } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import { AppQuery } from "./__generated__/AppQuery.graphql";

const App: React.FC = () => {
  const result = useLazyLoadQuery<AppQuery>(
    graphql`
      query AppQuery {
        todos {
          edges {
            node {
              id
              description
              isCompleted
            }
          }
        }
      }
    `,
    { variables: {} }
  );
  if (result.error) {
    throw result.error;
  } else if (!result.data) {
    return null;
  }
  return (
    <section className="todoapp">
      <header className="header">
        <h1>todos</h1>
        <input
          className="new-todo"
          placeholder="What needs to be done?"
          autoFocus
        />
      </header>
      {/* <!-- This section should be hidden by default and shown when there are todos --> */}
      <section className="main">
        <input id="toggle-all" className="toggle-all" type="checkbox" />
        <label htmlFor="toggle-all">Mark all as complete</label>
        <ul className="todo-list">
          {/* <!-- These are here just to show the structure of the list items --> */}
          {/* <!-- List items should get the class `editing` when editing and `completed` when marked as completed --> */}
          {result.data.todos.edges.map(({ node }) => {
            return (
              <li key={node.id} className={node.isCompleted ? "completed" : ""}>
                <div className="view">
                  <input
                    className="toggle"
                    type="checkbox"
                    checked={node.isCompleted}
                    onChange={() => console.log("CHANGE!")}
                  />
                  <label>{node.description}</label>
                  <button className="destroy"></button>
                </div>
                {/* <input className="edit" value="Create a TodoMVC template" /> */}
              </li>
            );
          })}
        </ul>
      </section>
      {/* <!-- This footer should be hidden by default and shown when there are todos --> */}
      <footer className="footer">
        {/* <!-- This should be `0 items left` by default --> */}
        <span className="todo-count">
          <strong>0</strong> item left
        </span>
        {/* <!-- Remove this if you don't implement routing --> */}
        <ul className="filters">
          <li>
            <a className="selected" href="#/">
              All
            </a>
          </li>
          <li>
            <a href="#/active">Active</a>
          </li>
          <li>
            <a href="#/completed">Completed</a>
          </li>
        </ul>
        {/* <!-- Hidden if no completed items are left ↓ --> */}
        <button className="clear-completed">Clear completed</button>
      </footer>
    </section>
  );
};

export default App;
