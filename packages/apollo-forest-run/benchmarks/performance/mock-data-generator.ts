import { DocumentNode, FieldNode, SelectionSetNode, InlineFragmentNode, Kind, OperationDefinitionNode } from "graphql";
import { gql } from "@apollo/client";

/**
 * Dynamic GraphQL mock data generator that analyzes query structure
 * and generates appropriate mock data without hardcoding response structures.
 * 
 * Inspired by gqlc-bench's approach to dynamic data generation.
 */

interface MockOptions {
  seed?: number;
  arrayLength?: number;
  stringLength?: number;
}

interface TypeGenerators {
  [key: string]: (fieldName: string, options: MockOptions) => any;
}

class GraphQLMockDataGenerator {
  private options: MockOptions;
  private typeGenerators: TypeGenerators;
  private idCounter: number = 0;

  constructor(options: MockOptions = {}) {
    this.options = {
      seed: 12345,
      arrayLength: 3,
      stringLength: 10,
      ...options,
    };

    // Setup deterministic random generation
    this.setupTypeGenerators();
  }

  private setupTypeGenerators(): void {
    this.typeGenerators = {
      ID: (fieldName: string) => `${fieldName}_${this.generateId()}`,
      String: (fieldName: string) => this.generateString(fieldName),
      Int: (fieldName: string) => this.generateInt(fieldName),
      Float: (fieldName: string) => this.generateFloat(fieldName),
      Boolean: (fieldName: string) => this.generateBoolean(fieldName),
      DateTime: (fieldName: string) => new Date().toISOString(),
    };
  }

  private generateId(): string {
    return `${Date.now()}_${++this.idCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateString(fieldName: string): string {
    const baseNames: { [key: string]: string[] } = {
      name: ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson'],
      title: ['Important Task', 'Critical Feature', 'Bug Fix', 'Enhancement'],
      content: ['Lorem ipsum dolor sit amet', 'Consectetur adipiscing elit', 'Sed do eiusmod tempor'],
      email: ['user@example.com', 'test@domain.org', 'admin@company.com'],
      bio: ['Software developer passionate about technology', 'Designer focused on user experience'],
      avatar: ['avatar1.jpg', 'avatar2.png', 'profile.gif'],
      description: ['An amazing organization', 'Leading technology company', 'Innovative startup'],
      text: ['Great comment!', 'Very helpful', 'Thanks for sharing'],
      role: ['Developer', 'Manager', 'Designer', 'Analyst'],
      scope: ['read', 'write', 'admin', 'view'],
      status: ['active', 'pending', 'completed', 'todo', 'done'],
      type: ['project', 'task', 'user', 'organization'],
    };

    const candidates = baseNames[fieldName.toLowerCase()] || 
                      baseNames[this.findMatchingKey(baseNames, fieldName)] ||
                      [`Generated ${fieldName}`];
    
    const index = Math.abs(this.hashCode(fieldName)) % candidates.length;
    return candidates[index];
  }

  private findMatchingKey(baseNames: { [key: string]: string[] }, fieldName: string): string {
    const keys = Object.keys(baseNames);
    for (let i = 0; i < keys.length; i++) {
      if (fieldName.toLowerCase().indexOf(keys[i]) >= 0) {
        return keys[i];
      }
    }
    return '';
  }

  private generateInt(fieldName: string): number {
    const hash = Math.abs(this.hashCode(fieldName));
    return (hash % 1000) + 1;
  }

  private generateFloat(fieldName: string): number {
    const hash = Math.abs(this.hashCode(fieldName));
    return ((hash % 10000) / 100) + 0.01;
  }

  private generateBoolean(fieldName: string): boolean {
    return Math.abs(this.hashCode(fieldName)) % 2 === 0;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Generate mock data for a GraphQL query
   */
  generateMockData(query: DocumentNode, variables: Record<string, any> = {}): any {
    const operation = query.definitions.find(
      def => def.kind === Kind.OPERATION_DEFINITION
    ) as OperationDefinitionNode;

    if (!operation) {
      throw new Error('No operation definition found in query');
    }

    return this.generateSelectionSetData(operation.selectionSet, 'Query', variables);
  }

  private generateSelectionSetData(
    selectionSet: SelectionSetNode, 
    typename: string, 
    variables: Record<string, any>,
    parentPath: string = ''
  ): any {
    const result: any = {};

    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        const fieldName = selection.name.value;
        const fullPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;

        if (fieldName === '__typename') {
          result[fieldName] = typename;
        } else if (fieldName === 'id') {
          result[fieldName] = this.generateId();
        } else if (selection.selectionSet) {
          // This field has sub-selections, so it's an object or array
          result[fieldName] = this.generateNestedData(selection, fullPath, variables);
        } else {
          // This is a scalar field
          result[fieldName] = this.generateScalarValue(fieldName, fullPath);
        }
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        // Handle inline fragments (... on Type)
        const fragmentTypename = selection.typeCondition?.name.value || typename;
        const fragmentData = this.generateSelectionSetData(
          selection.selectionSet, 
          fragmentTypename, 
          variables,
          parentPath
        );
        // Merge fragment data into result
        for (const key in fragmentData) {
          if (fragmentData.hasOwnProperty(key)) {
            result[key] = fragmentData[key];
          }
        }
      }
    }

    return result;
  }

  private generateNestedData(field: FieldNode, path: string, variables: Record<string, any>): any {
    const fieldName = field.name.value;
    
    // Determine if this should be an array based on field name patterns
    const isArray = this.shouldBeArray(fieldName);
    
    if (isArray) {
      return this.generateArrayData(field, path, variables);
    } else {
      return this.generateObjectData(field, path, variables);
    }
  }

  private shouldBeArray(fieldName: string): boolean {
    // Common patterns that suggest arrays
    const arrayPatterns = [
      'edges', 'nodes', 'items', 'list', 'posts', 'comments', 'users', 
      'teams', 'members', 'projects', 'tasks', 'permissions', 'dependencies'
    ];
    
    const fieldLower = fieldName.toLowerCase();
    for (let i = 0; i < arrayPatterns.length; i++) {
      if (fieldLower.indexOf(arrayPatterns[i]) >= 0) {
        return true;
      }
    }
    
    // Check if ends with 's'
    return fieldLower.charAt(fieldLower.length - 1) === 's';
  }

  private generateArrayData(field: FieldNode, path: string, variables: Record<string, any>): any[] {
    const arrayLength = this.options.arrayLength || 3;
    const result: any[] = [];

    for (let i = 0; i < arrayLength; i++) {
      const typename = this.inferTypename(field.name.value, i);
      const itemData = this.generateSelectionSetData(
        field.selectionSet!,
        typename,
        variables,
        `${path}[${i}]`
      );
      result.push(itemData);
    }

    return result;
  }

  private generateObjectData(field: FieldNode, path: string, variables: Record<string, any>): any {
    const typename = this.inferTypename(field.name.value);
    return this.generateSelectionSetData(
      field.selectionSet!,
      typename,
      variables,
      path
    );
  }

  private inferTypename(fieldName: string, index?: number): string {
    // Map field names to likely type names
    const typeMapping: { [key: string]: string } = {
      node: 'Node',
      user: 'User',
      profile: 'Profile',
      posts: 'PostConnection',
      edges: 'PostEdge', 
      author: 'User',
      comments: 'Comment',
      teams: 'Team',
      members: 'TeamMember',
      projects: 'Project',
      tasks: 'Task',
      assignee: 'User',
      dependencies: 'Task',
      permissions: 'Permission',
      resource: 'Resource',
    };

    // Handle connection patterns (edges -> Edge, nodes -> Node)
    if (fieldName === 'edges') {
      return 'Edge';
    } else if (fieldName === 'nodes') {
      return 'Node';
    }

    const mapped = typeMapping[fieldName.toLowerCase()];
    if (mapped) return mapped;

    // Default: capitalize field name
    return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  }

  private generateScalarValue(fieldName: string, path: string): any {
    const fieldLower = fieldName.toLowerCase();
    
    // Try to infer type from field name
    if (fieldLower.indexOf('id') >= 0) {
      return this.generateId();
    } else if (fieldLower.indexOf('email') >= 0) {
      return this.generateString('email');
    } else if (fieldLower.indexOf('date') >= 0 || fieldLower.indexOf('time') >= 0) {
      return new Date().toISOString();
    } else if (fieldLower.indexOf('count') >= 0 || fieldLower.indexOf('number') >= 0) {
      return this.generateInt(fieldName);
    } else if (fieldLower.indexOf('price') >= 0 || fieldLower.indexOf('amount') >= 0) {
      return this.generateFloat(fieldName);
    } else if (fieldLower.indexOf('active') >= 0 || fieldLower.indexOf('enabled') >= 0) {
      return this.generateBoolean(fieldName);
    } else {
      // Default to string
      return this.generateString(fieldName);
    }
  }

  generateVariableValue(varName: string, varDef: any): any {
    const varLower = varName.toLowerCase();
    // Simple variable value generation based on variable name
    if (varLower.indexOf('id') >= 0) {
      return this.generateId();
    } else if (varLower.indexOf('first') >= 0 || varLower.indexOf('count') >= 0) {
      return 10;
    } else if (varLower.indexOf('filter') >= 0) {
      return 'recent';
    } else {
      return `${varName}_value`;
    }
  }
}

/**
 * Generate mock data and variables for a GraphQL query string
 */
export function generateQueryMockData(
  queryString: string, 
  baseVariables: Record<string, any> = {},
  options: MockOptions = {}
): { variables: Record<string, any>; result: any } {
  const query = gql(queryString);
  const generator = new GraphQLMockDataGenerator(options);
  
  // Generate variables based on query requirements
  const variables = { ...baseVariables };
  
  // Parse operation to find variable requirements
  const operation = query.definitions.find(
    def => def.kind === Kind.OPERATION_DEFINITION
  ) as OperationDefinitionNode;

  if (operation?.variableDefinitions) {
    operation.variableDefinitions.forEach(varDef => {
      const varName = varDef.variable.name.value;
      if (!(varName in variables)) {
        // Generate default variable values
        variables[varName] = generator.generateVariableValue(varName, varDef);
      }
    });
  }

  const result = generator.generateMockData(query, variables);
  
  return { variables, result };
}

export { GraphQLMockDataGenerator };
export type { MockOptions };