import { DocumentNode, FieldNode, SelectionSetNode, InlineFragmentNode, Kind, OperationDefinitionNode } from "graphql";
import { gql } from "@apollo/client";

/**
 * Simple GraphQL mock data generator that analyzes query structure
 * and generates appropriate mock data.
 */

interface MockOptions {
  seed?: number;
  arrayLength?: number;
}

class GraphQLMockDataGenerator {
  private options: MockOptions;
  private idCounter: number = 0;

  constructor(options: MockOptions = {}) {
    this.options = {
      seed: 12345,
      arrayLength: 3,
      ...options,
    };
  }

  private generateId(): string {
    return `id_${++this.idCounter}_${this.options.seed}`;
  }

  private generateString(fieldName: string): string {
    const patterns: Record<string, () => string> = {
      name: () => `Mock Name ${this.idCounter}`,
      title: () => `Mock Title ${this.idCounter}`,
      email: () => `user${this.idCounter}@example.com`,
      content: () => `Mock content for ${fieldName} ${this.idCounter}`,
      bio: () => `Mock bio ${this.idCounter}`,
      comment: () => `Mock comment ${this.idCounter}`,
      avatar: () => `https://example.com/avatar${this.idCounter}.jpg`,
    };

    const generator = patterns[fieldName.toLowerCase()] || (() => `Mock ${fieldName} ${this.idCounter}`);
    return generator();
  }

  private generateNumber(fieldName: string): number {
    const patterns: Record<string, () => number> = {
      price: () => Math.floor(Math.random() * 1000) + 1,
      rating: () => Math.floor(Math.random() * 5) + 1,
      likes: () => Math.floor(Math.random() * 100),
      age: () => Math.floor(Math.random() * 80) + 18,
    };

    const generator = patterns[fieldName.toLowerCase()] || (() => Math.floor(Math.random() * 100));
    return generator();
  }

  private generateFieldValue(fieldName: string, fieldType?: string): any {
    // Handle common field name patterns
    if (fieldName === 'id' || fieldName.endsWith('Id')) {
      return this.generateId();
    }
    
    if (fieldName === '__typename') {
      return 'MockType';
    }

    if (fieldName.includes('At') || fieldName.includes('Date')) {
      return new Date().toISOString();
    }

    if (fieldName === 'cursor') {
      return `cursor_${this.idCounter}`;
    }

    if (fieldName === 'hasNextPage') {
      return Math.random() > 0.5;
    }

    if (fieldName === 'endCursor') {
      return `end_cursor_${this.idCounter}`;
    }

    // Handle numeric fields
    if (['price', 'rating', 'likes', 'age', 'first', 'count'].includes(fieldName.toLowerCase())) {
      return this.generateNumber(fieldName);
    }

    // Default to string
    return this.generateString(fieldName);
  }

  private processSelectionSet(selectionSet: SelectionSetNode): any {
    const result: any = {};

    selectionSet.selections.forEach(selection => {
      if (selection.kind === Kind.FIELD) {
        const field = selection as FieldNode;
        const fieldName = field.name.value;

        if (field.selectionSet) {
          if (fieldName === 'edges') {
            // Handle GraphQL connection pattern
            result[fieldName] = Array.from({ length: this.options.arrayLength! }, () => ({
              node: this.processSelectionSet(field.selectionSet!),
              cursor: this.generateFieldValue('cursor')
            }));
          } else if (fieldName === 'pageInfo') {
            result[fieldName] = this.processSelectionSet(field.selectionSet!);
          } else if (this.isArrayField(fieldName)) {
            // Handle array fields
            result[fieldName] = Array.from({ length: this.options.arrayLength! }, () => 
              this.processSelectionSet(field.selectionSet!)
            );
          } else {
            // Handle object fields
            result[fieldName] = this.processSelectionSet(field.selectionSet!);
          }
        } else {
          // Handle scalar fields
          result[fieldName] = this.generateFieldValue(fieldName);
        }
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        const fragment = selection as InlineFragmentNode;
        if (fragment.selectionSet) {
          Object.assign(result, this.processSelectionSet(fragment.selectionSet));
        }
      }
    });

    return result;
  }

  private isArrayField(fieldName: string): boolean {
    const arrayFields = ['posts', 'comments', 'reviews', 'users', 'departments', 'teams', 'members', 'projects', 'tasks'];
    return arrayFields.includes(fieldName.toLowerCase()) || fieldName.endsWith('s');
  }

  generateMockData(queryString: string, variables: any = {}): { variables: any; result: any } {
    const document = gql(queryString);
    const operation = document.definitions[0] as OperationDefinitionNode;
    
    if (!operation.selectionSet) {
      throw new Error('Query must have a selection set');
    }

    const result = this.processSelectionSet(operation.selectionSet);
    
    return {
      variables: { id: this.generateId(), ...variables },
      result
    };
  }
}

export function generateQueryMockData(
  queryString: string, 
  variables: any = {}, 
  options: MockOptions = {}
): { variables: any; result: any } {
  const generator = new GraphQLMockDataGenerator(options);
  return generator.generateMockData(queryString, variables);
}
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