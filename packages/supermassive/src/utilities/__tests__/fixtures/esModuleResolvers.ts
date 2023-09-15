export const MyInterfaceType = {
  __resolveType: () => "MyObjectType",
};

export const foo = () => {
  return "Result";
};

export const MyObjectType = {
  foo,
};
