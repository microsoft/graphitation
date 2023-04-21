import React from "react";
import clsx from "clsx";
import styles from "./HomepageFeatures.module.css";
import Link from "@docusaurus/Link";

type FeatureItem = {
  title: string | JSX.Element;
  image: string;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: <Link to="docs/learn-graphql/intro">Learn GraphQL</Link>,
    image: "img/graphql-logo-rhodamine.png",
    description: (
      <>
        Comprehensive documentation for learning GraphQL, following all
        best-practices.
      </>
    ),
  },
  {
    title: (
      <Link to="docs/packages/apollo-react-relay-duct-tape/intro">
        Packages
      </Link>
    ),
    image: "img/graphitation-logo.png",
    description: (
      <>
        Graphitation is a monorepo that contains various NPM packages that we
        use in MS Teams and other M365 projects. All of these are available as
        Open-Source Software.
      </>
    ),
  },
];

function Feature({ title, image, description }: FeatureItem) {
  return (
    <div className={clsx("col col--6")}>
      <div className="text--center">
        <img className={styles.featureSvg} alt={title} src={image} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
