import React, { useEffect } from 'react';
import { GraphQLError } from 'graphql';
import gql from 'graphql-tag';
import { act } from 'react-dom/test-utils';
import { render, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { ApolloClient, ApolloLink, ApolloQueryResult, Cache, NetworkStatus, Observable, ObservableQuery, TypedDocumentNode } from '../../../core';
import { InMemoryCache } from '../../../cache';
import { itAsync, MockedProvider, mockSingleLink, subscribeAndCount } from '../../../testing';
import { ApolloProvider } from '../../context';
import { useQuery } from '../useQuery';
import { useMutation } from '../useMutation';

describe('useMutation Hook', () => {
  interface Todo {
    id: number;
    description: string;
    priority: string;
  }

  const CREATE_TODO_MUTATION = gql`
    mutation createTodo($description: String!, $priority: String) {
      createTodo(description: $description, priority: $priority) {
        id
        description
        priority
      }
    }
  `;

  const CREATE_TODO_RESULT = {
    createTodo: {
      id: 1,
      description: 'Get milk!',
      priority: 'High',
      __typename: 'Todo'
    }
  };

  const CREATE_TODO_ERROR = 'Failed to create item';

  describe('General use', () => {
    it('should handle a simple mutation properly', async () => {
      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const { result, waitForNextUpdate } = renderHook(
        () => useMutation(CREATE_TODO_MUTATION),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toBe(undefined);
      const createTodo = result.current[0];
      act(() => void createTodo({ variables }));
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toEqual(CREATE_TODO_RESULT);
    });

    it('should be able to call mutations as an effect', async () => {
      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const useCreateTodo = () => {
        const [createTodo, { loading, data }] = useMutation(
          CREATE_TODO_MUTATION
        );
        useEffect(() => {
          createTodo({ variables });
        }, [variables]);

        return { loading, data };
      };

      const { result, waitForNextUpdate } = renderHook(
        () => useCreateTodo(),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(CREATE_TODO_RESULT);
    });

    it('should ensure the mutation callback function has a stable identity no matter what', async () => {
      const variables1 = {
        description: 'Get milk',
      };

      const data1 = {
        createTodo: {
          id: 1,
          description: 'Get milk!',
          priority: 'High',
          __typename: 'Todo',
        }
      };

      const variables2 = {
        description: 'Write blog post',
      };

      const data2 = {
        createTodo: {
          id: 1,
          description: 'Write blog post',
          priority: 'High',
          __typename: 'Todo',
        },
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: variables1,
          },
          result: { data: data1 },
        },
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: variables2,
          },
          result: { data: data2 },
        },
      ];

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ variables }) => useMutation(CREATE_TODO_MUTATION, { variables }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          ),
          initialProps: {
            variables: variables1,
          },
        },
      );

      const createTodo = result.current[0];
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toBe(undefined);

      act(() => void createTodo());
      expect(createTodo).toBe(result.current[0]);
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current[0]).toBe(createTodo);
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toEqual(data1);

      rerender({ variables: variables2 });
      act(() => void createTodo());

      await waitForNextUpdate();
      expect(result.current[0]).toBe(createTodo);
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toEqual(data2);
    });

    it('should resolve mutate function promise with mutation results', async () => {
      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const { result } = renderHook(
        () => useMutation(CREATE_TODO_MUTATION),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      await act(async () => {
        await expect(result.current[0]({ variables })).resolves.toEqual({
          data: CREATE_TODO_RESULT,
        });
      });
    });

    describe('mutate function upon error', () => {
      it('resolves with the resulting data and errors', async () => {
        const variables = {
          description: 'Get milk!'
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables,
            },
            result: {
              data: CREATE_TODO_RESULT,
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          }
        ];

        const onError = jest.fn();
        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { onError }),
          { wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          )},
        );

        const createTodo = result.current[0];
        let fetchResult: any;
        await act(async () => {
          fetchResult = await createTodo({ variables });
        });

        expect(fetchResult.data).toBe(undefined);
        expect(fetchResult.errors.message).toBe(CREATE_TODO_ERROR);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].message).toBe(CREATE_TODO_ERROR);
      });

      it('should reject when there’s only an error and no error policy is set', async () => {
        const variables = {
          description: 'Get milk!'
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables,
            },
            result: {
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          }
        ];

        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION),
          { wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          )},
        );

        const createTodo = result.current[0];
        let fetchError: any;
        await act(async () => {
          // need to call createTodo this way to get “act” warnings to go away.
          try {
            await createTodo({ variables });
          } catch (err) {
            fetchError = err;
            return;
          }

          throw new Error("function did not error");
        });

        expect(fetchError).toEqual(new GraphQLError(CREATE_TODO_ERROR));
      });

      it(`should reject when errorPolicy is 'none'`, async () => {
        const variables = {
          description: 'Get milk!'
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables
            },
            result: {
              data: CREATE_TODO_RESULT,
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          }
        ];

        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: 'none' }),
          { wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          )},
        );

        const createTodo = result.current[0];
        await act(async () => {
          await expect(createTodo({ variables })).rejects.toThrow(CREATE_TODO_ERROR);
        });
      });

      it(`should resolve with 'data' and 'error' properties when errorPolicy is 'all'`, async () => {
        const variables = {
          description: 'Get milk!'
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables
            },
            result: {
              data: CREATE_TODO_RESULT,
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          }
        ];

        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: 'all' }),
          { wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          )},
        );

        const createTodo = result.current[0];

        let fetchResult: any;
        await act(async () => {
          fetchResult = await createTodo({ variables });
        });

        expect(fetchResult.data).toEqual(CREATE_TODO_RESULT);
        expect(fetchResult.errors[0].message).toEqual(CREATE_TODO_ERROR);
      });

      it(`should ignore errors when errorPolicy is 'ignore'`, async () => {
        const errorMock = jest.spyOn(console, "error")
          .mockImplementation(() => {});
        const variables = {
          description: 'Get milk!'
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables,
            },
            result: {
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          }
        ];

        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: "ignore" }),
          { wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          )},
        );

        const createTodo = result.current[0];
        let fetchResult: any;
        await act(async () => {
          fetchResult = await createTodo({ variables });
        });

        expect(fetchResult).toEqual({});
        // ForestRun doesn't support this yet
        // expect(errorMock).toHaveBeenCalledTimes(1);
        // expect(errorMock.mock.calls[0][0]).toMatch("Missing field");
        errorMock.mockRestore();
      });
    });

    it('should return the current client instance in the result object', async () => {
      const { result } = renderHook(
        () => useMutation(CREATE_TODO_MUTATION),
        { wrapper: ({ children }) => (
          <MockedProvider>
            {children}
          </MockedProvider>
        )},
      );
      expect(result.current[1].client).toBeInstanceOf(ApolloClient);
    });

    it('should merge provided variables', async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          description: 'Get milk!',
          priority: 'Low',
          __typename: 'Todo',
        },
      };
      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: {
              priority: 'Low',
              description: 'Get milk.'
            }
          },
          result: {
            data: CREATE_TODO_DATA,
          }
        }
      ];

      const { result } = renderHook(
        () => useMutation<
          { createTodo: Todo },
          { priority?: string, description?: string }
        >(CREATE_TODO_MUTATION, {
          variables: { priority: 'Low' }
        }),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      const createTodo = result.current[0];
      let fetchResult: any;
      await act(async () => {
        fetchResult = await createTodo({ variables: { description: 'Get milk.' }});
      });

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
    });

    it('should be possible to reset the mutation', async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          priority: 'Low',
          description: 'Get milk!',
          __typename: 'Todo',
        },
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: {
              priority: 'Low',
              description: 'Get milk.',
            }
          },
          result: {
            data: CREATE_TODO_DATA,
          }
        }
      ];

      const { result, waitForNextUpdate } = renderHook(
        () => useMutation<
          { createTodo: Todo },
          { priority: string, description: string }
        >(CREATE_TODO_MUTATION),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      const createTodo = result.current[0];
      let fetchResult: any;
      await act(async () => {
        fetchResult = await createTodo({
          variables: { priority: 'Low', description: 'Get milk.' },
        });
      });

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
      expect(result.current[1].data).toEqual(CREATE_TODO_DATA);
      setTimeout(() => {
        result.current[1].reset();
      });

      await waitForNextUpdate();
      expect(result.current[1].data).toBe(undefined);
    });
  });

  describe('Callbacks', () => {
    it('should allow passing an onCompleted handler to the execution function', async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          priority: 'Low',
          description: 'Get milk!',
          __typename: 'Todo',
        },
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: {
              priority: 'Low',
              description: 'Get milk.',
            }
          },
          result: {
            data: CREATE_TODO_DATA,
          },
        }
      ];

      const { result } = renderHook(
        () => useMutation<
          { createTodo: Todo },
          { priority: string, description: string }
        >(CREATE_TODO_MUTATION),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      const createTodo = result.current[0];
      let fetchResult: any;
      const onCompleted = jest.fn();
      const onError = jest.fn();
      await act(async () => {
        fetchResult = await createTodo({
          variables: { priority: 'Low', description: 'Get milk.' },
          onCompleted,
          onError,
        });
      });

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
      expect(result.current[1].data).toEqual(CREATE_TODO_DATA);
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith(CREATE_TODO_DATA);
      expect(onError).toHaveBeenCalledTimes(0);
    });

    it('should allow passing an onError handler to the execution function', async () => {
      const errors = [new GraphQLError(CREATE_TODO_ERROR)];
      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: {
              priority: 'Low',
              description: 'Get milk.',
            },
          },
          result: {
            errors,
          },
        }
      ];

      const { result } = renderHook(
        () => useMutation<
          { createTodo: Todo },
          { priority: string, description: string }
        >(CREATE_TODO_MUTATION),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      const createTodo = result.current[0];
      let fetchResult: any;
      const onCompleted = jest.fn();
      const onError = jest.fn();
      await act(async () => {
        fetchResult = await createTodo({
          variables: { priority: 'Low', description: 'Get milk.' },
          onCompleted,
          onError,
        });
      });

      expect(fetchResult).toEqual({
        data: undefined,
        // Not sure why we unwrap errors here.
        errors: errors[0],
      });

      expect(onCompleted).toHaveBeenCalledTimes(0);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(errors[0]);
    });

    it('should allow updating onError while mutation is executing', async () => {
      const errors = [new GraphQLError(CREATE_TODO_ERROR)];
      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: {
              priority: 'Low',
              description: 'Get milk.',
            },
          },
          result: {
            errors,
          },
        }
      ];

      const onCompleted = jest.fn();
      const onError = jest.fn();
      const { result, rerender } = renderHook(
        ({ onCompleted, onError }) => {
          return useMutation<
            { createTodo: Todo },
            { priority: string, description: string }
          >(CREATE_TODO_MUTATION, { onCompleted, onError });
        },
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          ),
          initialProps: { onCompleted, onError },
        },
      );

      const createTodo = result.current[0];
      let fetchResult: any;
      const mutationPromise = act(async () => {
        fetchResult = await createTodo({
          variables: { priority: 'Low', description: 'Get milk.' },
        });
      });

      const onError1 = jest.fn();
      rerender({ onCompleted, onError: onError1 });
      await mutationPromise;

      expect(fetchResult).toEqual({
        data: undefined,
        // Not sure why we unwrap errors here.
        errors: errors[0],
      });

      expect(onCompleted).toHaveBeenCalledTimes(0);
      expect(onError).toHaveBeenCalledTimes(0);
      expect(onError1).toHaveBeenCalledTimes(1);
      expect(onError1).toHaveBeenCalledWith(errors[0]);
    });

    it('should never allow onCompleted handler to be stale', async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          priority: 'Low',
          description: 'Get milk!',
          __typename: 'Todo',
        },
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: {
              priority: 'Low',
              description: 'Get milk.',
            }
          },
          result: {
            data: CREATE_TODO_DATA,
          },
        }
      ];

      const onCompleted = jest.fn();
      const { result, rerender } = renderHook(
        ({ onCompleted }) => {
          return useMutation<
            { createTodo: Todo },
            { priority: string, description: string }
          >(CREATE_TODO_MUTATION, { onCompleted });
        },
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          ),
          initialProps: { onCompleted },
        },
      );

      const onCompleted1 = jest.fn();
      rerender({ onCompleted: onCompleted1 });
      const createTodo = result.current[0];
      let fetchResult: any;
      await act(async () => {
        fetchResult = await createTodo({
          variables: { priority: 'Low', description: 'Get milk.' },
        });
      });

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
      expect(result.current[1].data).toEqual(CREATE_TODO_DATA);
      expect(onCompleted).toHaveBeenCalledTimes(0);
      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted1).toHaveBeenCalledWith(CREATE_TODO_DATA);
    });

    it('should allow updating onCompleted while mutation is executing', async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          priority: 'Low',
          description: 'Get milk!',
          __typename: 'Todo',
        },
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: {
              priority: 'Low',
              description: 'Get milk.',
            }
          },
          result: {
            data: CREATE_TODO_DATA,
          },
        }
      ];

      const onCompleted = jest.fn();
      const { result, rerender } = renderHook(
        ({ onCompleted }) => {
          return useMutation<
            { createTodo: Todo },
            { priority: string, description: string }
          >(CREATE_TODO_MUTATION, { onCompleted });
        },
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          ),
          initialProps: { onCompleted },
        },
      );

      const createTodo = result.current[0];
      let fetchResult: any;
      const mutationPromise = act(async () => {
        fetchResult = await createTodo({
          variables: { priority: 'Low', description: 'Get milk.' },
        });
      });

      const onCompleted1 = jest.fn();
      rerender({ onCompleted: onCompleted1 });
      await mutationPromise;

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
      expect(result.current[1].data).toEqual(CREATE_TODO_DATA);
      expect(onCompleted).toHaveBeenCalledTimes(0);
      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted1).toHaveBeenCalledWith(CREATE_TODO_DATA);
    });
  });

  describe('ROOT_MUTATION cache data', () => {
    const startTime = Date.now();
    const link = new ApolloLink(operation => new Observable(observer => {
      observer.next({
        data: {
          __typename: "Mutation",
          doSomething: {
            __typename: "MutationPayload",
            time: startTime,
          },
        },
      });
      observer.complete();
    }));

    // ForestRun: doesn't cache mutation results by default. They must be explicitly marked as cacheable.
    const mutation = gql`
      mutation DoSomething @cache {
        doSomething {
          time
        }
      }
    `;

    it('should be removed by default after the mutation', async () => {
      let timeReadCount = 0;
      let timeMergeCount = 0;
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            MutationPayload: {
              fields: {
                time: {
                  read(ms: number = Date.now()) {
                    ++timeReadCount;
                    return new Date(ms);
                  },
                  merge(existing, incoming: number) {
                    ++timeMergeCount;
                    expect(existing).toBeUndefined();
                    return incoming;
                  },
                },
              },
            },
          },
        }),
      });

      const { result, waitForNextUpdate } = renderHook(
        () => useMutation(mutation),
        { wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        )},
      );

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(false);
      expect(result.current[1].data).toBe(undefined);
      const mutate = result.current[0];

      let mutationResult: any
      act(() => {
        mutationResult = mutate({
          update(cache, {
            data: {
              doSomething: {
                __typename,
                time,
              },
            },
          }) {
            expect(__typename).toBe("MutationPayload");
            expect(time).toBeInstanceOf(Date);
            expect(time.getTime()).toBe(startTime);
            expect(timeReadCount).toBe(1);
            expect(timeMergeCount).toBe(1);
            // The contents of the ROOT_MUTATION object exist only briefly,
            // for the duration of the mutation update, and are removed
            // after the mutation write is finished.
            expect(cache.extract()).toEqual({
              ROOT_MUTATION: {
                __typename: "Mutation",
                doSomething: {
                  __typename: "MutationPayload",
                  time: startTime,
                },
              },
            });
          },
        }).then(({
          data: {
            doSomething: {
              __typename,
              time,
            },
          },
        }) => {
          expect(__typename).toBe("MutationPayload");
          expect(time).toBeInstanceOf(Date);
          expect(time.getTime()).toBe(startTime);
          expect(timeReadCount).toBe(1);
          expect(timeMergeCount).toBe(1);
          // The contents of the ROOT_MUTATION object exist only briefly,
          // for the duration of the mutation update, and are removed after
          // the mutation write is finished.
          expect(client.cache.extract()).toEqual({
            ROOT_MUTATION: {
              __typename: "Mutation",
            },
          });
        });
        mutationResult.catch(() => {});
      });

      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBeDefined();

      const {
        doSomething: {
          __typename,
          time,
        },
      } = result.current[1].data;
      expect(__typename).toBe('MutationPayload');
      expect(time).toBeInstanceOf(Date);
      expect(time.getTime()).toBe(startTime);

      // ForestRun doesn't remove mutation results (yet)
      // await expect(mutationResult).resolves.toBe(undefined);
    });

    it('can be preserved by passing keepRootFields: true', async () => {
      let timeReadCount = 0;
      let timeMergeCount = 0;

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            MutationPayload: {
              fields: {
                time: {
                  read(ms: number = Date.now()) {
                    ++timeReadCount;
                    return new Date(ms);
                  },
                  merge(existing, incoming: number) {
                    ++timeMergeCount;
                    expect(existing).toBeUndefined();
                    return incoming;
                  },
                },
              },
            },
          },
        }),
      });

      const { result, waitForNextUpdate } = renderHook(
        () => useMutation(mutation, {
          keepRootFields: true,
        }),
        { wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        )},
      );

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(false);
      expect(result.current[1].data).toBe(undefined);
      const mutate = result.current[0];

      let mutationResult: any
      act(() => {
        mutationResult = mutate({
          update(cache, {
            data: {
              doSomething: {
                __typename,
                time,
              },
            },
          }) {
            expect(__typename).toBe("MutationPayload");
            expect(time).toBeInstanceOf(Date);
            expect(time.getTime()).toBe(startTime);
            expect(timeReadCount).toBe(1);
            expect(timeMergeCount).toBe(1);
            expect(cache.extract()).toEqual({
              ROOT_MUTATION: {
                __typename: "Mutation",
                doSomething: {
                  __typename: "MutationPayload",
                  time: startTime,
                },
              },
            });
          },
        }).then(({
          data: {
            doSomething: {
              __typename,
              time,
            },
          },
        }) => {
          expect(__typename).toBe("MutationPayload");
          expect(time).toBeInstanceOf(Date);
          expect(time.getTime()).toBe(startTime);
          expect(timeReadCount).toBe(1);
          expect(timeMergeCount).toBe(1);
          expect(client.cache.extract()).toEqual({
            ROOT_MUTATION: {
              __typename: "Mutation",
              doSomething: {
                __typename: "MutationPayload",
                time: startTime,
              },
            },
          });
        });
      });

      mutationResult.catch(() => {});
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBeDefined();

      const {
        doSomething: {
          __typename,
          time,
        },
      } = result.current[1].data;
      expect(__typename).toBe('MutationPayload');
      expect(time).toBeInstanceOf(Date);
      expect(time.getTime()).toBe(startTime);

      await expect(mutationResult).resolves.toBe(undefined);
    });
  });

  describe('Update function', () => {
    it('should be called with the provided variables', async () => {
      const variables = { description: 'Get milk!' };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      let variablesMatched = false;
      const Component = () => {
        const [createTodo] = useMutation(
          CREATE_TODO_MUTATION,
          {
            update(_, __, options) {
              expect(options.variables).toEqual(variables);
              variablesMatched = true;
            }
          }
        );

        useEffect(() => {
          createTodo({ variables });
        }, []);

        return null;
      };

      render(
        <MockedProvider mocks={mocks}>
          <Component />
        </MockedProvider>
      );

      await waitFor(() => expect(variablesMatched).toBe(true));
    });

    itAsync('should be called with the provided context', (resolve, reject) => {
      const context = { id: 3 };

      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      let foundContext = false;
      const Component = () => {
        const [createTodo] = useMutation<Todo, { description: string }, { id: number }>(
          CREATE_TODO_MUTATION,
          {
            context,
            update(_, __, options) {
              expect(options.context).toEqual(context);
              foundContext = true;
            }
          }
        );

        useEffect(() => {
          createTodo({ variables });
        }, []);

        return null;
      };

      render(
        <MockedProvider mocks={mocks}>
          <Component />
        </MockedProvider>
      );

      return waitFor(() => {
        expect(foundContext).toBe(true);
      }).then(resolve, reject);
    });

    describe('If context is not provided', () => {
      itAsync('should be undefined', (resolve, reject) => {
        const variables = {
          description: 'Get milk!'
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables
            },
            result: { data: CREATE_TODO_RESULT }
          }
        ];

        let checkedContext = false;
        const Component = () => {
          const [createTodo] = useMutation(
            CREATE_TODO_MUTATION,
            {
              update(_, __, options) {
                expect(options.context).toBeUndefined();
                checkedContext = true;
              }
            }
          );

          useEffect(() => {
            createTodo({ variables });
          }, []);

          return null;
        };

        render(
          <MockedProvider mocks={mocks}>
            <Component />
          </MockedProvider>
        );

        return waitFor(() => {
          expect(checkedContext).toBe(true);
        }).then(resolve, reject);
      });
    });
  });

  describe('Optimistic response', () => {
    itAsync('should support optimistic response handling', async (resolve, reject) => {
      const optimisticResponse = {
        __typename: 'Mutation',
        createTodo: {
          id: 1,
          description: 'TEMPORARY',
          priority: 'High',
          __typename: 'Todo'
        }
      };

      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const link = mockSingleLink(...mocks).setOnError(reject);
      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link
      });

      let renderCount = 0;
      const Component = () => {
        const [createTodo, { loading, data }] = useMutation(
          CREATE_TODO_MUTATION,
          { optimisticResponse }
        );

        switch (renderCount) {
          case 0:
            expect(loading).toBeFalsy();
            expect(data).toBeUndefined();
            createTodo({ variables });

            const dataInStore = client.cache.extract(true);
            expect(dataInStore['Todo:1']).toEqual(
              optimisticResponse.createTodo
            );

            break;
          case 1:
            expect(loading).toBeTruthy();
            expect(data).toBeUndefined();
            break;
          case 2:
            expect(loading).toBeFalsy();
            expect(data).toEqual(CREATE_TODO_RESULT);
            break;
          default:
        }
        renderCount += 1;
        return null;
      };

      render(
        <ApolloProvider client={client}>
          <Component />
        </ApolloProvider>
      );

      return waitFor(() => {
        expect(renderCount).toBe(3);
      }).then(resolve, reject);
    });

    itAsync('should be called with the provided context', async (resolve, reject) => {
      const optimisticResponse = {
        __typename: 'Mutation',
        createTodo: {
          id: 1,
          description: 'TEMPORARY',
          priority: 'High',
          __typename: 'Todo'
        }
      };

      const context = { id: 3 };

      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const contextFn = jest.fn();

      const Component = () => {
        const [createTodo] = useMutation(
          CREATE_TODO_MUTATION,
          {
            optimisticResponse,
            context,
            update(_, __, options) {
              contextFn(options.context);
            }
          }
        );

        useEffect(() => {
          createTodo({ variables });
        }, []);

        return null;
      };

      render(
        <MockedProvider mocks={mocks}>
          <Component />
        </MockedProvider>
      );

      return waitFor(() => {
        expect(contextFn).toHaveBeenCalledTimes(2);
        expect(contextFn).toHaveBeenCalledWith(context);
      }).then(resolve, reject);
    });
  });

  // FIXME: this is flaky, need to investigate
  describe.skip('refetching queries', () => {
    const GET_TODOS_QUERY = gql`
      query getTodos {
        todos {
          id
          description
          priority
        }
      }
    `;

    const GET_TODOS_RESULT_1 = {
      todos: [
        {
          id: 2,
          description: 'Walk the dog',
          priority: 'Medium',
          __typename: 'Todo'
        },
        {
          id: 3,
          description: 'Call mom',
          priority: 'Low',
          __typename: 'Todo'
        },
      ],
    };

    const GET_TODOS_RESULT_2 = {
      todos: [
        {
          id: 1,
          description: 'Get milk!',
          priority: 'High',
          __typename: 'Todo'
        },
        {
          id: 2,
          description: 'Walk the dog',
          priority: 'Medium',
          __typename: 'Todo'
        },
        {
          id: 3,
          description: 'Call mom',
          priority: 'Low',
          __typename: 'Todo'
        },
      ],
    };

    it('can pass onQueryUpdated to useMutation', async () => {
      interface TData {
        todoCount: number;
      }
      const countQuery: TypedDocumentNode<TData> = gql`
        query Count { todoCount @client }
      `;

      const optimisticResponse = {
        __typename: 'Mutation',
        createTodo: {
          id: 1,
          description: 'TEMPORARY',
          priority: 'High',
          __typename: 'Todo'
        }
      };

      const variables = {
        description: 'Get milk!'
      };

      const client = new ApolloClient({
        cache: new InMemoryCache({
          typePolicies: {
            Query: {
              fields: {
                todoCount(count = 0) {
                  return count;
                },
              },
            },
          },
        }),

        link: mockSingleLink({
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: { data: CREATE_TODO_RESULT },
          delay: 20,
        }),
      });

      // The goal of this test is to make sure onQueryUpdated gets called as
      // part of the createTodo mutation, so we use this reobservePromise to
      // await the calling of onQueryUpdated.
      interface OnQueryUpdatedResults {
        obsQuery: ObservableQuery;
        diff: Cache.DiffResult<TData>;
        result: ApolloQueryResult<TData>;
      }
      let resolveOnUpdate: (results: OnQueryUpdatedResults) => any;
      const onUpdatePromise = new Promise<OnQueryUpdatedResults>(resolve => {
        resolveOnUpdate = resolve;
      }).then((onUpdateResult) => {
        expect(finishedReobserving).toBe(true);
        expect(onUpdateResult.diff).toEqual({
          complete: true,
          result: {
            todoCount: 1,
          },
        });
        expect(onUpdateResult.result).toEqual({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            todoCount: 1,
          },
        });
      });

      onUpdatePromise.catch(() => {});

      let finishedReobserving = false;
      const { result, waitForNextUpdate } = renderHook(() => ({
        query: useQuery(countQuery),
        mutation: useMutation(CREATE_TODO_MUTATION, {
          optimisticResponse,
          update(cache) {
            const result = cache.readQuery({ query: countQuery });

            cache.writeQuery({
              query: countQuery,
              data: {
                todoCount: (result ? result.todoCount : 0) + 1,
              },
            });
          },
        }),
      }), {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      });

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual({ todoCount: 0 });
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.mutation[1].data).toBe(undefined);
      const createTodo = result.current.mutation[0];
      act(() => {
        createTodo({
          variables,
          async onQueryUpdated(obsQuery, diff) {
            const result = await obsQuery.reobserve();
            finishedReobserving = true;
            resolveOnUpdate({ obsQuery, diff, result });
            return result;
          },
        });
      });

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual({ todoCount: 0 });
      expect(result.current.mutation[1].loading).toBe(true);
      expect(result.current.mutation[1].data).toBe(undefined);
      expect(finishedReobserving).toBe(false);

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual({ todoCount: 1 });
      expect(result.current.mutation[1].loading).toBe(true);
      expect(result.current.mutation[1].data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual({ todoCount: 1 });
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.mutation[1].data).toEqual(CREATE_TODO_RESULT);
      expect(finishedReobserving).toBe(true);

      await expect(onUpdatePromise).resolves.toBe(undefined);
    });

    it('refetchQueries with operation names should update cache', async () => {
      const variables = { description: 'Get milk!' };
      const mocks = [
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_1 },
        },
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_RESULT,
          },
        },
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_2 },
        },
      ];

      const link = mockSingleLink(...mocks);
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result, waitForNextUpdate, waitForValueToChange } = renderHook(
        () => ({
          query: useQuery(GET_TODOS_QUERY),
          mutation: useMutation(CREATE_TODO_MUTATION),
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.data).toBe(undefined);
      await waitForNextUpdate();

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);
      const mutate = result.current.mutation[0];
      setTimeout(() => {
        act(() => {
          mutate({
            variables,
            refetchQueries: ['getTodos'],
          });
        });
      });

      await waitForValueToChange(() => result.current.query.data);
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[2].result.data);

      expect(client.readQuery({ query: GET_TODOS_QUERY}))
        .toEqual(mocks[2].result.data);
    });

    it('refetchQueries with document nodes should update cache', async () => {
      const variables = { description: 'Get milk!' };
      const mocks = [
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_1 },
        },
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_RESULT,
          },
          delay: 10,
        },
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_2 },
          delay: 10,
        },
      ];

      const link = mockSingleLink(...mocks);
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result, waitForNextUpdate } = renderHook(
        () => ({
          query: useQuery(GET_TODOS_QUERY),
          mutation: useMutation(CREATE_TODO_MUTATION),
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.data).toBe(undefined);
      await waitForNextUpdate();

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);
      const mutate = result.current.mutation[0];
      act(() => {
        mutate({
          variables,
          refetchQueries: [GET_TODOS_QUERY],
        });
      });
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[2].result.data);
      expect(client.readQuery({ query: GET_TODOS_QUERY }))
        .toEqual(mocks[2].result.data);
    });

    it('refetchQueries should update cache after unmount', async () => {
      const variables = { description: 'Get milk!' };
      const mocks = [
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_1 },
        },
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_RESULT,
          },
        },
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_2 },
        },
      ];

      const link = mockSingleLink(...mocks);
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result, waitForNextUpdate, unmount } = renderHook(
        () => ({
          query: useQuery(GET_TODOS_QUERY),
          mutation: useMutation(CREATE_TODO_MUTATION),
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.data).toBe(undefined);
      await waitForNextUpdate();

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);
      const mutate = result.current.mutation[0];
      let onMutationDone: Function;
      const mutatePromise = new Promise((resolve) => (onMutationDone = resolve));
      setTimeout(() => {
        act(() => {
          mutate({
            variables,
            refetchQueries: ['getTodos'],
            update() {
              unmount();
            },
          }).then(result => {
            expect(result.data).toEqual(CREATE_TODO_RESULT);
            onMutationDone();
          });
        });
      });

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);

      await mutatePromise;

      return waitFor(() => {
        expect(
          client.readQuery({ query: GET_TODOS_QUERY })
        ).toEqual(mocks[2].result.data);
      });
    });

    itAsync("using onQueryUpdated callback should not prevent cache broadcast", async (resolve, reject) => {
      // Mutating this array makes the tests below much more difficult to reason
      // about, so instead we reassign the numbersArray variable to remove
      // elements, without mutating the previous array object.
      let numbersArray: ReadonlyArray<{ id: string; value: number }> = [
        { id: '1', value: 324 },
        { id: '2', value: 729 },
        { id: '3', value: 987 },
        { id: '4', value: 344 },
        { id: '5', value: 72 },
        { id: '6', value: 899 },
        { id: '7', value: 222 },
      ];

      type TNumbersQuery = {
        numbers: {
          __typename: "NumbersResult";
          id: string;
          sum: number;
          numbersArray: ReadonlyArray<{
            id: string;
            value: number;
          }>;
        };
      };

      function getNumbersData(): TNumbersQuery {
        return {
          numbers: {
            __typename: "NumbersResult",
            id: "numbersId",
            numbersArray,
            sum: numbersArray.reduce((sum, b) => sum + b.value, 0),
          },
        };
      }

      const link = new ApolloLink((operation) => {
        return new Observable(observer => {
          const { operationName } = operation;
          if (operationName === "NumbersQuery") {
            observer.next({
              data: getNumbersData(),
            });
          } else if (operationName === "RemoveNumberMutation") {
            const last = numbersArray[numbersArray.length - 1];
            numbersArray = numbersArray.slice(0, -1);
            observer.next({
              data: {
                removeLastNumber: last,
              },
            });
          }
          setTimeout(() => {
            observer.complete();
          }, 50);
        });
      });

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            NumbersResult: {
              fields: {
                numbersArray: { merge: false },
                sum(_, { readField }) {
                  const numbersArray =
                    readField<TNumbersQuery["numbers"]["numbersArray"]>("numbersArray");
                  return (numbersArray || []).reduce(
                    (sum, item) => sum + item.value,
                    0,
                  );
                },
              },
            },
          },
        }),
      });

      const NumbersQuery: TypedDocumentNode<TNumbersQuery> = gql`
        query NumbersQuery {
          numbers {
            id
            sum
            numbersArray {
              id
              value
            }
          }
        }
      `;

      // ForestRun: doesn't cache mutation results by default. They must be explicitly marked as cacheable.
      const RemoveNumberMutation = gql`
        mutation RemoveNumberMutation @cache {
          removeLastNumber {
            id
          }
        }
      `;

      const { result, waitForNextUpdate } = renderHook(() => ({
        query: useQuery(NumbersQuery, {
          notifyOnNetworkStatusChange: true,
        }),

        mutation: useMutation(RemoveNumberMutation, {
          update(cache) {
            const oldData = cache.readQuery({ query: NumbersQuery });
            cache.writeQuery({
              query: NumbersQuery,
              data: oldData ? {
                ...oldData,
                numbers: {
                  ...oldData.numbers,
                  numbersArray: oldData.numbers.numbersArray.slice(0, -1),
                },
              } : {
                numbers: {
                  __typename: "NumbersResult",
                  id: "numbersId",
                  sum: 0,
                  numbersArray: [],
                },
              },
            });
          },
        }),
      }), {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      });

      const obsQueryMap = client.getObservableQueries();
      expect(obsQueryMap.size).toBe(1);
      const observedResults: Array<{ data: TNumbersQuery }> = [];
      subscribeAndCount(reject, obsQueryMap.values().next().value, (
        count,
        result: { data: TNumbersQuery },
      ) => {
        observedResults.push(result);
        expect(observedResults.length).toBe(count);
        const data = getNumbersData();

        if (count === 1) {
          expect(result).toEqual({
            loading: true,
            networkStatus: NetworkStatus.loading,
            partial: true,
          });

        } else if (count === 2) {
          expect(data.numbers.numbersArray.length).toBe(7);
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data,
          });

        } else if (count === 3) {
          expect(data.numbers.numbersArray.length).toBe(6);
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data,
          });

        } else if (count === 4) {
          expect(data.numbers.numbersArray.length).toBe(5);
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data,
          });

          // This line is the only way to finish this test successfully.
          setTimeout(resolve, 50);

        } else {
          // If we did not return false from the final onQueryUpdated function,
          // we would receive an additional result here.
          reject(`too many renders (${count}); final result: ${
            JSON.stringify(result)
          }`);
        }
      });

      expect(observedResults).toEqual([]);

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.networkStatus).toBe(NetworkStatus.loading);
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.mutation[1].called).toBe(false);
      await waitForNextUpdate();

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.mutation[1].called).toBe(false);

      expect(numbersArray[numbersArray.length - 1]).toEqual({
        id: '7',
        value: 222,
      });

      const [mutate] = result.current.mutation;
      await act(async () => {
        expect(await mutate(
          // Not passing an onQueryUpdated callback should allow cache
          // broadcasts to propagate as normal. The point of this test is to
          // demonstrate that *adding* onQueryUpdated should not prevent cache
          // broadcasts (see below for where we test that).
        )).toEqual({
          data: {
            removeLastNumber: {
              id: '7',
            },
          },
        });
      });

      expect(numbersArray[numbersArray.length - 1]).toEqual({
        id: '6',
        value: 899,
      });

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.mutation[1].called).toBe(true);

      await act(async () => {
        expect(await mutate({
          // Adding this onQueryUpdated callback, which merely examines the
          // updated query and its DiffResult, should not change the broadcast
          // behavior of the ObservableQuery.
          onQueryUpdated(oq, diff) {
            expect(oq.queryName).toBe("NumbersQuery");
            expect(diff.result.numbers.numbersArray.length).toBe(5);
            expect(diff.result.numbers.sum).toBe(2456);
          },
        })).toEqual({
          data: {
            removeLastNumber: {
              id: '6',
            },
          },
        });
      });

      expect(numbersArray[numbersArray.length - 1]).toEqual({
        id: '5',
        value: 72,
      });

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.mutation[1].called).toBe(true);

      await act(async () => {
        expect(await mutate({
          onQueryUpdated(oq, diff) {
            expect(oq.queryName).toBe("NumbersQuery");
            expect(diff.result.numbers.numbersArray.length).toBe(4);
            expect(diff.result.numbers.sum).toBe(2384);
            // Returning false from onQueryUpdated prevents the cache broadcast.
            return false;
          },
        })).toEqual({
          data: {
            removeLastNumber: {
              id: '5',
            },
          },
        });
      });

      expect(numbersArray[numbersArray.length - 1]).toEqual({
        id: '4',
        value: 344,
      });

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.networkStatus).toBe(NetworkStatus.ready);
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.mutation[1].called).toBe(true);
    });
  });
});
