import React from "react";
import { useQuery, gql } from "@apollo/client";

const MESSAGE = gql`
  query message($id: ID) {
    message(id: $id) {
      id
      message
    }
  }
`;

export default ({ id }: { id: string }) => {
  const { data } = useQuery(MESSAGE, { variables: { id } });

  return <div>{data?.message?.message}</div>;
};
