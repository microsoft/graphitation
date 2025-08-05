"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLMockDataGenerator = void 0;
exports.generateQueryMockData = generateQueryMockData;
const graphql_1 = require("graphql");
const client_1 = require("@apollo/client");
class GraphQLMockDataGenerator {
    constructor(options = {}) {
        this.idCounter = 0;
        this.options = {
            seed: 12345,
            arrayLength: 3,
            stringLength: 10,
            ...options,
        };
        // Setup deterministic random generation
        this.setupTypeGenerators();
    }
    setupTypeGenerators() {
        this.typeGenerators = {
            ID: (fieldName) => `${fieldName}_${this.generateId()}`,
            String: (fieldName) => this.generateString(fieldName),
            Int: (fieldName) => this.generateInt(fieldName),
            Float: (fieldName) => this.generateFloat(fieldName),
            Boolean: (fieldName) => this.generateBoolean(fieldName),
            DateTime: (fieldName) => new Date().toISOString(),
        };
    }
    generateId() {
        return `${Date.now()}_${++this.idCounter}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateString(fieldName) {
        const baseNames = {
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
    findMatchingKey(baseNames, fieldName) {
        const keys = Object.keys(baseNames);
        for (let i = 0; i < keys.length; i++) {
            if (fieldName.toLowerCase().indexOf(keys[i]) >= 0) {
                return keys[i];
            }
        }
        return '';
    }
    generateInt(fieldName) {
        const hash = Math.abs(this.hashCode(fieldName));
        return (hash % 1000) + 1;
    }
    generateFloat(fieldName) {
        const hash = Math.abs(this.hashCode(fieldName));
        return ((hash % 10000) / 100) + 0.01;
    }
    generateBoolean(fieldName) {
        return Math.abs(this.hashCode(fieldName)) % 2 === 0;
    }
    hashCode(str) {
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
    generateMockData(query, variables = {}) {
        const operation = query.definitions.find(def => def.kind === graphql_1.Kind.OPERATION_DEFINITION);
        if (!operation) {
            throw new Error('No operation definition found in query');
        }
        return this.generateSelectionSetData(operation.selectionSet, 'Query', variables);
    }
    generateSelectionSetData(selectionSet, typename, variables, parentPath = '') {
        var _a;
        const result = {};
        for (const selection of selectionSet.selections) {
            if (selection.kind === graphql_1.Kind.FIELD) {
                const fieldName = selection.name.value;
                const fullPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
                if (fieldName === '__typename') {
                    result[fieldName] = typename;
                }
                else if (fieldName === 'id') {
                    result[fieldName] = this.generateId();
                }
                else if (selection.selectionSet) {
                    // This field has sub-selections, so it's an object or array
                    result[fieldName] = this.generateNestedData(selection, fullPath, variables);
                }
                else {
                    // This is a scalar field
                    result[fieldName] = this.generateScalarValue(fieldName, fullPath);
                }
            }
            else if (selection.kind === graphql_1.Kind.INLINE_FRAGMENT) {
                // Handle inline fragments (... on Type)
                const fragmentTypename = ((_a = selection.typeCondition) === null || _a === void 0 ? void 0 : _a.name.value) || typename;
                const fragmentData = this.generateSelectionSetData(selection.selectionSet, fragmentTypename, variables, parentPath);
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
    generateNestedData(field, path, variables) {
        const fieldName = field.name.value;
        // Determine if this should be an array based on field name patterns
        const isArray = this.shouldBeArray(fieldName);
        if (isArray) {
            return this.generateArrayData(field, path, variables);
        }
        else {
            return this.generateObjectData(field, path, variables);
        }
    }
    shouldBeArray(fieldName) {
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
    generateArrayData(field, path, variables) {
        const arrayLength = this.options.arrayLength || 3;
        const result = [];
        for (let i = 0; i < arrayLength; i++) {
            const typename = this.inferTypename(field.name.value, i);
            const itemData = this.generateSelectionSetData(field.selectionSet, typename, variables, `${path}[${i}]`);
            result.push(itemData);
        }
        return result;
    }
    generateObjectData(field, path, variables) {
        const typename = this.inferTypename(field.name.value);
        return this.generateSelectionSetData(field.selectionSet, typename, variables, path);
    }
    inferTypename(fieldName, index) {
        // Map field names to likely type names
        const typeMapping = {
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
        }
        else if (fieldName === 'nodes') {
            return 'Node';
        }
        const mapped = typeMapping[fieldName.toLowerCase()];
        if (mapped)
            return mapped;
        // Default: capitalize field name
        return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    }
    generateScalarValue(fieldName, path) {
        const fieldLower = fieldName.toLowerCase();
        // Try to infer type from field name
        if (fieldLower.indexOf('id') >= 0) {
            return this.generateId();
        }
        else if (fieldLower.indexOf('email') >= 0) {
            return this.generateString('email');
        }
        else if (fieldLower.indexOf('date') >= 0 || fieldLower.indexOf('time') >= 0) {
            return new Date().toISOString();
        }
        else if (fieldLower.indexOf('count') >= 0 || fieldLower.indexOf('number') >= 0) {
            return this.generateInt(fieldName);
        }
        else if (fieldLower.indexOf('price') >= 0 || fieldLower.indexOf('amount') >= 0) {
            return this.generateFloat(fieldName);
        }
        else if (fieldLower.indexOf('active') >= 0 || fieldLower.indexOf('enabled') >= 0) {
            return this.generateBoolean(fieldName);
        }
        else {
            // Default to string
            return this.generateString(fieldName);
        }
    }
    generateVariableValue(varName, varDef) {
        const varLower = varName.toLowerCase();
        // Simple variable value generation based on variable name
        if (varLower.indexOf('id') >= 0) {
            return this.generateId();
        }
        else if (varLower.indexOf('first') >= 0 || varLower.indexOf('count') >= 0) {
            return 10;
        }
        else if (varLower.indexOf('filter') >= 0) {
            return 'recent';
        }
        else {
            return `${varName}_value`;
        }
    }
}
exports.GraphQLMockDataGenerator = GraphQLMockDataGenerator;
/**
 * Generate mock data and variables for a GraphQL query string
 */
function generateQueryMockData(queryString, baseVariables = {}, options = {}) {
    const query = (0, client_1.gql)(queryString);
    const generator = new GraphQLMockDataGenerator(options);
    // Generate variables based on query requirements
    const variables = { ...baseVariables };
    // Parse operation to find variable requirements
    const operation = query.definitions.find(def => def.kind === graphql_1.Kind.OPERATION_DEFINITION);
    if (operation === null || operation === void 0 ? void 0 : operation.variableDefinitions) {
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
