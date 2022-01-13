// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "graphitation",
  tagline: "GraphQL tooling & runtime support needed for MS Teams and beyond",
  url: "https://microsoft.github.io",
  baseUrl: "/graphitation/",
  onBrokenLinks: "warn", // TODO: Rever to "throw"
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",
  organizationName: "microsoft",
  projectName: "graphitation",
  trailingSlash: false,

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl:
            "https://github.com/microsoft/graphitation/tree/main/website/",
        },
        blog: {
          showReadingTime: true,
          editUrl:
            "https://github.com/microsoft/graphitation/tree/main/website/",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "graphitation",
        logo: {
          alt: "My Site Logo",
          src: "img/logo.svg",
        },
        items: [
          {
            type: "doc",
            docId: "apollo-react-relay-duct-tape/intro",
            position: "left",
            label: "Apollo React/Relay Duct-Tape",
          },
          {
            href: "https://github.com/microsoft/graphitation",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              {
                label: "Apollo React/Relay Duct-Tape",
                to: "/docs/apollo-react-relay-duct-tape/intro",
              },
            ],
          },
          {
            title: "Community",
            items: [
              // {
              //   label: "Stack Overflow",
              //   href: "https://stackoverflow.com/questions/tagged/docusaurus",
              // },
              // {
              //   label: "Discord",
              //   href: "https://discordapp.com/invite/docusaurus",
              // },
              // {
              //   label: "Twitter",
              //   href: "https://twitter.com/docusaurus",
              // },
              {
                label: "Teams",
                href:
                  "https://teams.microsoft.com/l/channel/19%3a487e60012b034c9e91db26c1fc0906d1%40thread.tacv2/GraphQL%2520(IDataClient)?groupId=505d3b35-052e-4bb7-a1f4-d1cdaec5f6a7&tenantId=72f988bf-86f1-41af-91ab-2d7cd011db47",
              },
            ],
          },
          // {
          //   title: "More",
          //   items: [
          //     {
          //       label: "Blog",
          //       to: "/blog",
          //     },
          //     {
          //       label: "GitHub",
          //       href: "https://github.com/facebook/docusaurus",
          //     },
          //   ],
          // },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Microsoft Corporation. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
