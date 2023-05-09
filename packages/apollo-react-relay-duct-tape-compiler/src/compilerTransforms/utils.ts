import invariant from "invariant";
import { CompilerContext, Fragment } from "relay-compiler";

export function implementsNodeInterface(
  context: CompilerContext,
  fragmentDefinition: Fragment,
) {
  const schema = context.getSchema();
  const nodeType = schema.getTypeFromString("Node");
  invariant(
    nodeType && schema.isInterface(nodeType),
    "Expected schema to define a Node interface in order to support narrow observables.",
  );
  return schema.getInterfaces(fragmentDefinition.type).includes(nodeType);
}
