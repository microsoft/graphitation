import React, { useState } from "react";
import { menuStyles } from "./menu.styles";
import { NavLink } from "react-router-dom";
import {
  Info24Regular,
  Flowchart24Regular,
  Database24Regular,
  DataFunnel24Regular,
  DataWhisker24Regular,
  Alert24Regular,
} from "@fluentui/react-icons";
import { mergeClasses, Text, Badge } from "@fluentui/react-components";
import { useArrowNavigationGroup } from "@fluentui/react-tabster";

interface MenuProps {
  cacheCount: number;
  mutationsCount: number;
  queriesCount: number;
  mutationsHaveError: boolean;
  queriesHaveError: boolean;
  hideGlobalOperations: boolean;
}

const menuElements = (props: MenuProps) => [
  {
    url: "/",
    name: `Cache`,
    icon: <Database24Regular />,
    badge: props.cacheCount,
  },
  {
    url: "apollo-queries",
    name: `Watched Queries`,
    icon: <DataFunnel24Regular />,
    badge: props.queriesCount,
    haveError: props.queriesHaveError,
  },
  {
    url: "apollo-mutations",
    name: `Mutations`,
    icon: <DataWhisker24Regular />,
    badge: props.mutationsCount,
    haveError: props.mutationsHaveError,
  },
  {
    url: "activity",
    name: "Activity",
    icon: <Alert24Regular />,
  },
  {
    url: "apollo-additional-informations",
    name: "Additional Information",
    icon: <Info24Regular />,
    hide: props.hideGlobalOperations,
  },
  {
    url: "graphiql",
    name: "GraphiQL",
    icon: <Flowchart24Regular />,
  },
];

export const Menu = React.memo((props: MenuProps) => {
  const classes = menuStyles();
  const [activeItem, setActiveItem] = useState(0);
  const menuAttributes = useArrowNavigationGroup({ circular: true });

  return (
    <nav className={classes.root} id="menu-container">
      <ul className={classes.menuList} {...menuAttributes}>
        {menuElements(props)
          .map((item, index) => {
            if (item.hide) {
              return;
            }

            return (
              <li key={item.name}>
                <NavLink
                  to={item.url}
                  tabIndex={0}
                  className={mergeClasses(
                    classes.menuItem,
                    activeItem === index && classes.menuItemActive
                  )}
                  onClick={() => setActiveItem(index)}
                >
                  <div className={classes.menuItemIcon}>{item.icon}</div>
                  {true && (
                    <Text className={classes.menuText}>{item.name}</Text>
                  )}
                  {item.badge && (
                    <Badge
                      appearance="tint"
                      color={item.haveError ? "danger" : "brand"}
                      className={classes.badge}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </NavLink>
              </li>
            );
          })
          .filter(Boolean)}
      </ul>
    </nav>
  );
});
