// @flow

import type { Models } from 'flowTypes';
import _ from 'lodash';

import gw2 from 'lib/gw2';

export async function list (models: Models) {
  const tokens = await models.Gw2ApiToken.findAll({
    where: {
      stub: false,
    },
  });

  return tokens.map((item) => item.dataValues);
}

type Tokens$Read = {
  id: number,
};

type Tokens$Create = {
  apiToken: string,
  userId: string,
  world: string,
  accountId: string,
  accountName: string,
  makePrimary: boolean,
  permissions: Array<string>,
};

const dataToToken = (data: Tokens$Create) => ({
  token: data.apiToken,
  UserId: data.userId,
  permissions: data.permissions.join(','),
  world: data.world,
  accountId: data.accountId,
  accountName: data.accountName,
  primary: data.makePrimary,
  valid: true,
});

export function create (models: Models, data: Tokens$Create) {
  return models.Gw2ApiToken.create(dataToToken(data));
}

export function read (models: Models, { id }: Tokens$Read) {
  return models.Gw2ApiToken.findOne({
    where: _.pickBy({
      id,
    }),
  });
}

export async function replace (models: Models, data: Tokens$Create) {
  const parsedData = dataToToken(data);
  const [count] = await models.Gw2ApiToken.update(parsedData, {
    where: {
      accountName: data.accountName,
      valid: false,
    },
  });

  if (count === 1) {
    return _.omit(parsedData, ['UserId']);
  }

  throw new Error(
    `Trying to replace api token failed. Updated ${count} instead. ${JSON.stringify(data)}`
  );
}

export function setValidity (models: Models, valid: boolean, token: string) {
  return models.Gw2ApiToken.update({
    valid,
  }, {
    where: {
      token,
    },
  });
}

export async function validate (models: Models, apiToken: string) {
  const token = await models.Gw2ApiToken.findOne({ where: { token: apiToken } });
  if (token) {
    throw new Error({
      property: 'apiToken',
      message: 'is already being used',
    });
  }

  const { permissions } = await gw2.readTokenInfo(apiToken);
  const hasCharacters = permissions.filter((item) => {
    return item === 'characters' || item === 'builds';
  });

  if (hasCharacters.length !== 2) {
    throw new Error({
      property: 'apiToken',
      message: 'needs characters and builds permission',
    });
  }

  const { id, name } = await gw2.readAccount(apiToken);
  const existingToken = await models.Gw2ApiToken.findOne({
    where: {
      accountId: id,
    },
  });

  if (existingToken) {
    throw new Error({
      property: 'apiToken',
      message: `key for ${name} already exists`,
    });
  }
}
