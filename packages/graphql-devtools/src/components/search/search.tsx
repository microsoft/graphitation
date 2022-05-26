import React from "react";
import { searchStyles } from "./search.styles";
import { Search20Regular } from "@fluentui/react-icons";

interface SearchProps {
  onSearchChange: (e: React.SyntheticEvent) => void
}

export const Search = React.memo(({ onSearchChange }: SearchProps) => {
  const classes = searchStyles();

  return (
    <div className={classes.root} >
			<Search20Regular className={classes.icon} />
      <input 
				className={classes.input}
				type="text"
				placeholder="Search..." 
        aria-roledescription="Search"
				onChange={(e: React.SyntheticEvent) => onSearchChange(e)} />
    </div>
  );
});
