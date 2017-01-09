// @flow

import type { Models, UserModel, PvpStandingModel } from 'flowTypes';
import _ from 'lodash';

import { read as readGuild } from './guild';

type ListOptions = {
  guild: string,
};

export async function list (models: Models, { guild }: ListOptions): Promise<Array<UserModel>> {
  const tokens = await models.Gw2ApiToken.findAll({
    where: {
      guilds: {
        $like: `%${guild}%`,
      },
    },
    include: [{
      model: models.User,
    }],
  });

  return tokens.map((token) => ({
    name: token.User.alias,
    accountName: token.accountName,
  }));
}

export async function isUserInGuild (
  models: Models,
  email: string,
  guildName: string,
): Promise<boolean> {
  const { id } = await readGuild(models, { name: guildName });

  const token = await models.Gw2ApiToken.findAll({
    where: {
      guilds: {
        $like: `%${id}%`,
      },
    },
    include: [{
      model: models.User,
      where: {
        email,
      },
    }],
  });

  return !!token.length;
}

export function parseUser (user: UserModel) {
  if (!user) {
    return Promise.reject('User not found');
  }

  return user.id;
}

export function getUserByEmail (models: Models, email: string) {
  return models.User.findOne({
    where: {
      email,
    },
  });
}

export function getUserIdByEmail (models: Models, email: string) {
  return getUserByEmail(models, email).then(parseUser);
}

export function getUserIdByAlias (models: Models, alias: string) {
  return models.User.findOne({
    where: {
      alias,
    },
  })
  .then(parseUser);
}

export async function getUserPrimaryToken (models: Models, alias: string) {
  const id = await getUserIdByAlias(models, alias);
  const token = await models
  .Gw2ApiToken
  .findOne({
    where: {
      primary: true,
    },
    include: [{
      model: models.User,
      where: {
        id,
      },
    }],
  });

  if (!token) {
    return Promise.reject('Token not found');
  }

  return token.token;
}

type ReadOptions = {
  apiToken: string,
};

export async function read (models: Models, { apiToken }: ReadOptions) {
  const token = await models.Gw2ApiToken.findOne({
    where: {
      token: apiToken,
    },
    include: [{
      model: models.User,
    }],
  });

  return token && {
    alias: token.User.dataValues.alias,
    accountName: token.accountName,
    apiToken,
  };
}
