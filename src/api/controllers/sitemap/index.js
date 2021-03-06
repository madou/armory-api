// @flow

import type { Models } from 'flowTypes';
import config from 'config';
import moment from 'moment';

import { publicRoutes, userRoutes, guildRoutes, characterRoutes } from './routes';

type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

type BuildUrlTemplateOptions = {
  loc: string,
  priority: string,
  updatedAt?: Date,
  changefreq?: ChangeFrequency,
};

const calcResourcesPerPage = () => {
  return {
    users: Math.floor(config.sitemap.pageItemLimit / userRoutes.length),
    guilds: Math.floor(config.sitemap.pageItemLimit / guildRoutes.length),
    characters: Math.floor(config.sitemap.pageItemLimit / characterRoutes.length),
  };
};

const calcPages = ({ users, characters, guilds }) => {
  const resourcesPerPage = calcResourcesPerPage();

  return {
    users: users / resourcesPerPage.users,
    characters: characters / resourcesPerPage.characters,
    guilds: guilds / resourcesPerPage.guilds,
  };
};

const buildUrlTemplate = ({ loc, updatedAt, priority, changefreq }: BuildUrlTemplateOptions) => {
  const tags = [
    `<loc>${config.web.publicUrl}/${encodeURI(loc)}</loc>`,
    updatedAt && `<lastmod>${updatedAt.toISOString()}</lastmod>`,
    priority && `<priority>${priority}</priority>`,
    changefreq && `<changefreq>${changefreq}</changefreq>`,
  ].filter((tag) => tag);

  return `  <url>
    ${tags.join('\n    ')}
  </url>`;
};

const buildSitemap = (items) =>
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items.join('\n')}
</urlset>`;

const buildUserData = (users) =>
  userRoutes.map(
    (route) => users.map((user) => buildUrlTemplate({
      loc: `${user.alias}${route.loc}`,
      priority: route.priority,
      updatedAt: user.updatedAt,
    }))
  );

const buildGuildData = (guilds) =>
  guildRoutes.map(
    (route) => guilds.map((guild) => buildUrlTemplate({
      loc: `g/${guild.name}${route.loc}`,
      priority: route.priority,
      updatedAt: guild.updatedAt,
    }))
  );

const buildCharacterData = (characters) =>
  characterRoutes.map(
    (route) =>
      characters.map((character) => buildUrlTemplate({
        loc: `${character.Gw2ApiToken.User.alias}/c/${character.name}${route.loc}`,
        priority: route.priority,
        updatedAt: character.updatedAt,
      }))
  );

export default function sitemapControllerFactory (models: Models) {
  function readResource (model, { offset, limit, include }: any) {
    return model.findAll({
      include,
      offset,
      limit,
    });
  }

  function countResources () {
    return Promise.all([
      models.User.count(),
      models.Gw2Guild.count(),
      models.Gw2Character.count(),
    ])
    .then(([users, guilds, characters]) => ({
      users,
      guilds,
      characters,
    }));
  }

  async function buildStaticPage () {
    const standing = await models.PvpStandings.findOne();

    const publicUpdatedAtMap = {
      'leaderboards/pvp': standing.updatedAt,
      'leaderboards/pvp/na': standing.updatedAt,
      'leaderboards/pvp/eu': standing.updatedAt,
    };

    return buildSitemap(
      publicRoutes.map((route) => buildUrlTemplate({
        ...route,
        // $FlowFixMe
        updatedAt: publicUpdatedAtMap[route.loc],
      }))
    );
  }

  type Resource = 'characters' | 'guilds' | 'users' | 'static';

  async function generate (resource: Resource, page?: number = 0) {
    if (resource === 'static') {
      return buildStaticPage();
    }

    const resourcesPerPage = calcResourcesPerPage();

    if (resource === 'users') {
      const weightedOffset = resourcesPerPage.users * page;
      const weightedLimit = resourcesPerPage.users;

      const users = await readResource(models.User, {
        offset: weightedOffset,
        limit: weightedLimit,
      });

      return buildSitemap(buildUserData(users));
    }

    if (resource === 'characters') {
      const weightedOffset = resourcesPerPage.characters * page;
      const weightedLimit = resourcesPerPage.characters;

      const characters = await readResource(models.Gw2Character, {
        offset: weightedOffset,
        limit: weightedLimit,
        include: [{
          model: models.Gw2ApiToken,
          include: [{
            model: models.User,
          }],
        }],
      });

      return buildSitemap(buildCharacterData(characters));
    }

    if (resource === 'guilds') {
      const weightedOffset = resourcesPerPage.guilds * page;
      const weightedLimit = resourcesPerPage.guilds;

      const guilds = await readResource(models.Gw2Guild, {
        offset: weightedOffset,
        limit: weightedLimit,
      });

      return buildSitemap(buildGuildData(guilds));
    }

    throw new Error('Resource not supported!');
  }

  const buildSitemaps = (resource, count) => {
    const sitemaps = [];

    for (let i = 0; i < count; i++) {
      sitemaps.push(`  <sitemap>
    <loc>${config.api.publicUrl}/sitemap-${resource}-${i}.xml</loc>
    <lastmod>${moment().toISOString()}</lastmod>
  </sitemap>`);
    }

    return sitemaps;
  };

  async function index () {
    const resourceCounts = await countResources();

    const pages = calcPages(resourceCounts);

    console.log(pages);

    const sitemaps = [
      ...buildSitemaps('static', 1),
      ...buildSitemaps('users', pages.users),
      ...buildSitemaps('characters', pages.characters),
      ...buildSitemaps('guilds', pages.guilds),
    ];

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.join('\n')}
</sitemapindex>`;
  }

  return {
    generate,
    index,
  };
}
