/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAsyncIterator, forAwaitEach, getAsyncIterator } from "iterall";
import { mapAsyncIterator } from "../../utilities/mapAsyncIterator";
import { FieldResolver, Resolvers } from "../../types";
import type { JsonDB } from "node-json-db";

type SwapiContext = { models: JsonDB };

const starships: FieldResolver<any, SwapiContext, any> = (
  parent,
  _args,
  { models },
) => {
  return mapAsyncIterator(
    getAsyncIterator(
      createAsyncIterator(
        models
          .getData("/starships")
          .filter(({ id }: { id: any }) => parent.starships.includes(id)),
      ),
    ) as unknown as AsyncIterable<any>,
    // this ensures it's a awaitable iterator

    async (item) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return item;
    },
  );
};

function people(key: string): FieldResolver<any, SwapiContext, any> {
  return (parent, _args, { models }) => {
    return models
      .getData("/people")
      .filter(({ id }: { id: any }) => parent[key].includes(id));
  };
}

const vehicles: FieldResolver<any, SwapiContext, any> = (
  parent,
  _args,
  { models },
) => {
  return models
    .getData("/vehicles")
    .filter(({ id }: { id: any }) => parent.vehicles.includes(id));
};

const planets: FieldResolver<any, SwapiContext, any> = (
  parent,
  _args,
  { models },
) => {
  return models
    .getData("/planets")
    .filter(({ id }: { id: any }) => parent.planets.includes(id));
};

const species: FieldResolver<any, SwapiContext, any> = (
  parent,
  _args,
  { models },
) => {
  return models
    .getData("/species")
    .filter(({ id }: { id: any }) => parent.species.includes(id));
};
const homeworld: FieldResolver<any, SwapiContext, any> = (
  parent,
  _args,
  { models },
) => {
  return models
    .getData("/planets")
    .find((planet: any) => planet.id === parent.homeworld);
};

const person: FieldResolver<any, SwapiContext, any> = (
  parent,
  { id },
  { models },
) => {
  return models.getData("/people").find((person: any) => person.id === id);
};

const planet: FieldResolver<any, SwapiContext, any> = (
  parent,
  { id },
  { models },
) => {
  return models.getData("/planets").find((planet: any) => planet.id === id);
};

const films: FieldResolver<any, SwapiContext, any> = (
  parent,
  _args,
  { models },
) => {
  return models.getData("/films");
};

const film: FieldResolver<any, SwapiContext, any> = (
  parent,
  { id },
  { models },
) => {
  return models.getData("/films").find((film: any) => film.id === id);
};

const starship: FieldResolver<any, SwapiContext, any> = (
  parent,
  { id },
  { models },
) => {
  return models
    .getData("/starships")
    .find((starship: any) => starship.id === id);
};

const transport: FieldResolver<any, SwapiContext, any> = (
  parent,
  { id },
  { models },
) => {
  return models
    .getData("/transport")
    .find((transport: any) => transport.id === id);
};

const vehicle: FieldResolver<any, SwapiContext, any> = (
  parent,
  { id },
  { models },
) => {
  return models.getData("/vehicles").find((vehicle: any) => vehicle.id === id);
};

const searchPeopleByName: FieldResolver<any, SwapiContext, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/people")
    .filter((person: any) => new RegExp(search, "i").test(person.name));
};

const searchPlanetsByName: FieldResolver<any, SwapiContext, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/planets")
    .filter((planet: any) => new RegExp(search, "i").test(planet.name));
};

const searchFilmsByTitle: FieldResolver<any, SwapiContext, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/films")
    .filter((film: any) => new RegExp(search, "i").test(film.title));
};

const searchSpeciesByName: FieldResolver<any, SwapiContext, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/species")
    .filter((species: any) => new RegExp(search, "i").test(species.name));
};

const searchStarshipsByName: FieldResolver<any, SwapiContext, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/starships")
    .filter((starship: any) => new RegExp(search, "i").test(starship.name));
};

const searchVehiclesByName: FieldResolver<any, SwapiContext, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/vehicles")
    .filter((vehicle: any) => new RegExp(search, "i").test(vehicle.name));
};

const emitPersons: FieldResolver<any, SwapiContext, any> = {
  subscribe: async function (parent, { limit, throwError }, { models }) {
    if (throwError) {
      throw new Error("error");
    }
    const persons = await models.getData("/people");
    const personsLimit = Math.min(limit, persons.length);
    const output = [];
    for (let i = 0; i < personsLimit; i++) {
      output.push({ emitPersons: persons[i] });
    }
    return createAsyncIterator(output);
  },
};

const emitPersonsV2: FieldResolver<any, SwapiContext, any> = {
  subscribe: async function (parent, { limit, throwError }, { models }) {
    if (throwError) {
      throw new Error("error");
    }
    const persons = await models.getData("/people");
    const personsLimit = Math.min(limit, persons.length);
    const output = [];
    for (let i = 0; i < personsLimit; i++) {
      output.push({ emitPersons: persons[i] });
    }
    return createAsyncIterator(output);
  },
  resolve: (parent, { emitError }) => {
    if (emitError && parent.emitPersons.name === "R2-D2") {
      throw new Error("No robots allowed");
    }
    return parent.emitPersons;
  },
};

const searchTransportsByName: FieldResolver<any, SwapiContext, any> = (
  parent,
  { search },
  { models },
) => {
  return models
    .getData("/transport")
    .filter((transport: any) => new RegExp(search, "i").test(transport.name));
};

const resolvers: Resolvers<any, SwapiContext> = {
  SearchResult: {
    __resolveType(parent: any) {
      return parent.__typename;
    },
  },
  Subscription: {
    emitPersons,
    emitPersonsV2,
    nonNullWithError: {
      subscribe() {
        throw new Error("Subscribe error");
      },
    },
    nonNullWithErrorEvent: {
      subscribe() {
        return createAsyncIterator(["foo"]);
      },
      resolve() {
        throw new Error("Subscription event error");
      },
    },
    nonNullWithNull: {
      subscribe() {
        return createAsyncIterator(["foo"]);
      },
      resolve() {},
    },
  },
  Query: {
    search(parent, { search }, { models }, info) {
      const result = [
        ...(
          searchFilmsByTitle(parent, { search }, { models }, info) as any
        ).map((r: any) => (r.__typename = "Film") && r),
        ...(
          searchPeopleByName(parent, { search }, { models }, info) as any
        ).map((r: any) => (r.__typename = "Person") && r),
        ...(
          searchPlanetsByName(parent, { search }, { models }, info) as any
        ).map((r: any) => (r.__typename = "Planet") && r),
        ...(
          searchSpeciesByName(parent, { search }, { models }, info) as any
        ).map((r: any) => (r.__typename = "Species") && r),
        ...(
          searchStarshipsByName(parent, { search }, { models }, info) as any
        ).map((r: any) => (r.__typename = "Starship") && r),
        ...(
          searchTransportsByName(parent, { search }, { models }, info) as any
        ).map((r: any) => (r.__typename = "Transport") && r),
        ...(
          searchVehiclesByName(parent, { search }, { models }, info) as any
        ).map((r: any) => (r.__typename = "Vehicle") && r),
      ];

      return result;
    },

    node(parent, args: any, context: any, info) {
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
        ...(result as any),
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

    allStarships(_parent, _args, { models }) {
      return models.getData("/starships");
    },
    allFilms(_parent, _args, { models }) {
      return models.getData("/films");
    },
    allPeople(_parent, _args, { models }) {
      return models.getData("/people");
    },
    allPlanets(_parent, _args, { models }) {
      return models.getData("/planets");
    },
    allSpecies(_parent, _args, { models }) {
      return models.getData("/species");
    },
    allTransports(_parent, _args, { models }) {
      return models.getData("/transport");
    },
    advancedDefaultInput(_parent, args) {
      return JSON.stringify(args);
    },
    multiArger(_parent, args) {
      return JSON.stringify(args);
    },
    nonNullWithError() {
      throw new Error("Query error");
    },
    nonNullWithNull() {},
  },
  Film: {
    starships,
    vehicles,
    planets,
    characters: people("characters"),
    species,
  },
  Starship: {
    MGLT: (starship: any) => +starship.MGLT,
    hyperdrive_rating: (starship: any) => +starship.hyperdrive_rating,
    cargo_capacity: (starship: any) => +starship.cargo_capacity,
    passengers: (starship: any) => +starship.passengers,
    max_atmosphering_speed: (starship: any) => +starship.max_atmosphering_speed,
    length: (starship: any) => +starship.length,
    cost_in_credits: (starship: any) => +starship.cost_in_credits,
    pilots: people("pilots"),
    films,
  },
  Person: {
    height: (pilot: any) => +pilot.height,
    mass: (pilot: any) => +pilot.mass,
    starships,
    homeworld,
    films,
    bubblingError: () => {
      throw new Error("Bubbling!");
    },
    bubblingListError: () => {
      return forAwaitEach([1, 2, 3], async (item) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (item === 2) {
          throw new Error("Bubbling in list!");
        }
        return item;
      });
    },
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
