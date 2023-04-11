---
sidebar_position: 5
id: faq
title: Frequently Asked Questions
---

# FAQ

## When should I expose a relationship as an object type?

Whenever you have a field called `somethingId` or `something_id`, it is most likely the case that you will want to expose `something` as a relationship with an object type.

If you do need just the raw identifier, e.g. for passing to APIs _oustide_ of GraphQL, the user can query for `something.id`.

[🔗 More information](./thinking-in-graphql.md#-design-from-back-end-perspective)
