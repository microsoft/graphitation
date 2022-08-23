# What needs to be done in codegen

- [ ] Finish the actual codegen (see tests)

  - [ ] Models should be imported directly, not via namespace, both in resolvers and models - done
  - [ ] Extends should work correctly (extend models with interfaces) - little bit tricky but also should be done
  - [ ] Input objects should work - done
  - [ ] Scalars should work like in codegen (configuration map, defaults to string) - probably need a discussion about it

- [ ] Add command to bin/supermassive to do command line codegen - Just an alpha version done, I need to discuss it more (due to context for example)

# Second phase notes

- I had to implement Unions too
- I don't know how context types should be solved (imported ? from which package, supermasive ? should it be configurable in the bin ? )
- Not sure if the basic scalars shoudln't be defined somewhere else.
- The extends point was little bit tricky, probably need to discuss it too.
- Still need little bit cleaning when all these points are solved
