# What needs to be done in codegen

- [ ] Finish the actual codegen (see tests)
  - [ ] Models should be imported directly, not via namespace, both in resolvers and models
  - [ ] Extends should work correctly (extend models with interfaces)
  - [ ] Input objects should work
  - [ ] Scalars should work like in codegen (configuration map, defaults to string)
- [ ] Add command to bin/supermassive to do command line codegen
