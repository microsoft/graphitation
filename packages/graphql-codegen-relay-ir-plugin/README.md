# Custom GraphQL codegen plugins

## supermassive-relay-ir-plugin

Add relay IR as one of the exports

TODO: THIS IS YARN LINK FRIENDLY RN.
Remove graphql from app node_module before using
Update this package to be release friendly
Add transform possibility

graphql imports should be resolved (see config obj of near operations)

use ast instead of parsing when possible

or add fragments directly to compiler context

? have compiler context that's reused / cached?

see why it's so f slow

add addTypename option to RelayApolloCache to add the field selection to outgoing documents and ensure the Relay IR also includes it if it needs it
