import { CompilerContext, Fragment } from "relay-compiler";

export function implementsNodeInterface(
  context: CompilerContext,
  fragmentDefinition: Fragment
) {
  const schema = context.getSchema();
  const nodeType = schema.getTypeFromString("Node");
  schema.assertInterfaceType(nodeType);
  return schema.getInterfaces(fragmentDefinition.type).includes(nodeType);
}
