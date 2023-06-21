cd packages/cli/
rm -R lib
yarn monorepo-scripts build
cd ../../
cd packages/ts-codegen/
rm -R lib
yarn monorepo-scripts build
cd ../../
cd ../teams-modular-packages-2
rm -R node_modules/@graphitation/cli/node_modules/@graphitation/ts-codegen/
rm -R node_modules/@graphitation/cli/lib
rm -R node_modules/@graphitation/ts-codegen/lib
cp -R ../graphitation/packages/cli/lib node_modules/@graphitation/cli/
cp -R ../graphitation/packages/ts-codegen/lib node_modules/@graphitation/ts-codegen/
yarn run generate:interfaces-v2