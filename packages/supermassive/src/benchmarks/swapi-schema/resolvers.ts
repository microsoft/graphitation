import { GraphQLFieldResolver } from "graphql/type/definition";
import { IExecutableSchemaDefinition } from "@graphql-tools/schema";
import { createAsyncIterator } from "iterall";

const films: GraphQLFieldResolver<any, any, any> = (
  parent,
  args,
  { models },
) => {
  return models
    .getData("/films")
    .filter(({ id }: { id: any }) => parent.films.includes(id));
};

const starships: GraphQLFieldResolver<any, any, any> = (
  parent,
  { id },
  { models },
) => {
  return models
    .getData("/starships")
    .filter(({ id }: { id: any }) => parent.starships.includes(id));
};

function people(key: string): GraphQLFieldResolver<any, any, any> {
  return (parent, args, { models }) => {
    return models
      .getData("/people")
      .filter(({ id }: { id: any }) => parent[key].includes(id));
  };
}

const vehicles: GraphQLFieldResolver<any, any, any> = (
  parent,
  args,
  { models },
) => {
  return models
    .getData("/vehicles")
    .filter(({ id }: { id: any }) => parent.vehicles.includes(id));
};

const transports: GraphQLFieldResolver<any, any, any> = (
  parent,
  args,
  { models },
) => {
  return models
    .getData("/transport")
    .filter(({ id }: { id: any }) => parent.starships.includes(id));
};

const planets: GraphQLFieldResolver<any, any, any> = (
  parent,
  args,
  { models },
) => {
  return models
    .getData("/planets")
    .filter(({ id }: { id: any }) => parent.planets.includes(id));
};

const species: GraphQLFieldResolver<any, any, any> = (
  parent,
  args,
  { models },
) => {
  return models
    .getData("/species")
    .filter(({ id }: { id: any }) => parent.species.includes(id));
};
const homeworld: GraphQLFieldResolver<any, any, any> = (
  parent,
  args,
  { models },
) => {
  return models
    .getData("/planets")
    .find((planet: any) => planet.id === parent.homeworld);
};

const person: GraphQLFieldResolver<any, any, any> = (
  parent,
  { id },
  { models },
) => {
  return models.getData("/people").find((person: any) => person.id === id);
};

const planet: GraphQLFieldResolver<any, any, any> = (
  parent,
  { id },
  { models },
) => {
  return models.getData("/planets").find((planet: any) => planet.id === id);
};

const film: GraphQLFieldResolver<any, any, any> = (
  parent,
  { id },
  { models },
) => {
  return models.getData("/films").find((film: any) => film.id === id);
};

const starship: GraphQLFieldResolver<any, any, any> = (
  parent,
  { id },
  { models },
) => {
  return models
    .getData("/starships")
    .find((starship: any) => starship.id === id);
};

const transport: GraphQLFieldResolver<any, any, any> = (
  parent,
  { id },
  { models },
) => {
  return models
    .getData("/transport")
    .find((transport: any) => transport.id === id);
};

const vehicle: GraphQLFieldResolver<any, any, any> = (
  parent,
  { id },
  { models },
) => {
  return models.getData("/vehicles").find((vehicle: any) => vehicle.id === id);
};

const searchPeopleByName: GraphQLFieldResolver<any, any, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/people")
    .filter((person: any) => new RegExp(search, "i").test(person.name));
};

const searchPlanetsByName: GraphQLFieldResolver<any, any, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/planets")
    .filter((planet: any) => new RegExp(search, "i").test(planet.name));
};

const searchFilmsByTitle: GraphQLFieldResolver<any, any, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/films")
    .filter((film: any) => new RegExp(search, "i").test(film.title));
};

const searchSpeciesByName: GraphQLFieldResolver<any, any, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/species")
    .filter((species: any) => new RegExp(search, "i").test(species.name));
};

const searchStarshipsByName: GraphQLFieldResolver<any, any, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/starships")
    .filter((starship: any) => new RegExp(search, "i").test(starship.name));
};

const searchVehiclesByName: GraphQLFieldResolver<any, any, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/vehicles")
    .filter((vehicle: any) => new RegExp(search, "i").test(vehicle.name));
};

const emitPersons: GraphQLFieldResolver<any, any, any> = async function (
  parent,
  { limit, throwError },
  { models },
) {
  if (throwError) {
    throw new Error("error");
    return;
  }
  const persons = await models.getData("/people");
  const personsLimit = Math.min(limit, persons.length);
  const output: any = { length: personsLimit };
  for (let i = 0; i < personsLimit; i++) {
    output[i] = { emitPersons: persons[i] };
  }
  return createAsyncIterator(output);
};

const searchTransportsByName: GraphQLFieldResolver<any, any, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/transport")
    .filter((transport: any) => new RegExp(search, "i").test(transport.name));
};

const resolvers: IExecutableSchemaDefinition["resolvers"] = {
  SearchResult: {
    __resolveType(parent: any) {
      return parent.__typename;
    },
  },
  Subscription: {
    emitPersons: {
      subscribe: emitPersons,
    },
  },
  Query: {
    search(parent, { search }, { models }, info) {
      const result = [
        ...searchFilmsByTitle(parent, { search }, { models }, info).map(
          (r: any) => (r.__typename = "Film") && r,
        ),
        ...searchPeopleByName(parent, { search }, { models }, info).map(
          (r: any) => (r.__typename = "Person") && r,
        ),
        ...searchPlanetsByName(parent, { search }, { models }, info).map(
          (r: any) => (r.__typename = "Planet") && r,
        ),
        ...searchSpeciesByName(parent, { search }, { models }, info).map(
          (r: any) => (r.__typename = "Species") && r,
        ),
        ...searchStarshipsByName(parent, { search }, { models }, info).map(
          (r: any) => (r.__typename = "Starship") && r,
        ),
        ...searchTransportsByName(parent, { search }, { models }, info).map(
          (r: any) => (r.__typename = "Transport") && r,
        ),
        ...searchVehiclesByName(parent, { search }, { models }, info).map(
          (r: any) => (r.__typename = "Vehicle") && r,
        ),
      ];

      return result;
    },

    node(parent, args, context, info) {
      let result;
      switch (args.nodeType) {
        case "Person": {
          result = person(parent, args, context, info);
          break;
        }
        case "Starship": {
          result = starship(parent, args, context, info);
          break;
        }
        case "Transport": {
          result = transport(parent, args, context, info);
          break;
        }
        case "Species": {
          result = species(parent, args, context, info);
          break;
        }
        case "Vehicle": {
          result = vehicle(parent, args, context, info);
          break;
        }
        case "Planet": {
          result = planet(parent, args, context, info);
          break;
        }
        case "Film": {
          result = film(parent, args, context, info);
          break;
        }
        default:
          throw new Error(`Invalid node type ${args.nodeType}`);
      }
      return {
        ...result,
        __typename: args.nodeType,
      };
    },

    person,
    planet,
    film,
    transport,
    starship,
    vehicle,
    searchPeopleByName,
    searchStarshipsByName,
    searchTransportsByName,
    searchSpeciesByName,
    searchVehiclesByName,
    searchPlanetsByName,
    searchFilmsByTitle,

    allStarships(parent, args, { models }) {
      return models.getData("/starships");
    },
    allFilms(parent, args, { models }) {
      return models.getData("/films");
    },
    allPeople(parent, args, { models }) {
      return models.getData("/people");
    },
    allPlanets(parent, args, { models }) {
      return models.getData("/planets");
    },
    allSpecies(parent, args, { models }) {
      return models.getData("/species");
    },
    allTransports(parent, args, { models }) {
      return models.getData("/transport");
    },
    advancedDefaultInput(parent, args) {
      return JSON.stringify(args);
    },
  },
  Film: {
    starships,
    vehicles,
    planets,
    characters: people("characters"),
    species,
  },
  Starship: {
    MGLT: (starship) => +starship.MGLT,
    hyperdrive_rating: (starship) => +starship.hyperdrive_rating,
    cargo_capacity: (starship) => +starship.cargo_capacity,
    passengers: (starship) => +starship.passengers,
    max_atmosphering_speed: (starship) => +starship.max_atmosphering_speed,
    length: (starship) => +starship.length,
    cost_in_credits: (starship) => +starship.cost_in_credits,
    pilots: people("pilots"),
    films,
  },
  Person: {
    height: (pilot) => +pilot.height,
    mass: (pilot) => +pilot.mass,
    starships,
    homeworld,
  },
  Vehicle: {
    cargo_capacity: (vehicle) => +vehicle.cargo_capacity,
    passengers: (vehicle) => +vehicle.passengers,
    max_atmosphering_speed: (vehicle) => +vehicle.max_atmosphering_speed,
    crew: (vehicle) => forceNumber(vehicle.crew),
    length: (vehicle) => +vehicle.length,
    cost_in_credits: (vehicle) => +vehicle.cost_in_credits,
    pilots: people("pilots"),
  },
  Planet: {
    diameter: (planet) => +planet.diameter,
    rotation_period: (planet) => +planet.rotation_period,
    orbital_period: (planet) => +planet.orbital_period,
    population: (planet) => +planet.population,
    residents: people("residents"),
    films,
  },
  Species: {
    average_lifespan: (species) => +species.average_lifespan,
    average_height: (species) => +species.average_height,
    homeworld,
    people: people("people"),
  },
  Transport: {
    cargo_capacity: (vehicle) => +vehicle.cargo_capacity,
    passengers: (vehicle) => +vehicle.passengers,
    max_atmosphering_speed: (vehicle) => +vehicle.max_atmosphering_speed,
    crew: (vehicle) => forceNumber(vehicle.crew),
    length: (vehicle) => +vehicle.length,
    cost_in_credits: (vehicle) => +vehicle.cost_in_credits,
  },
};

const forceNumber = (i: string) =>
  Number(i.split(",").join("").split("-")[0]) || -1;

export default resolvers;
