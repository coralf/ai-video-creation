import { createContext } from 'react';

export const ArtCreationContext = createContext(null);


export const ArtCreationProvider = (props: { children: any; value: any; }) => {
    const { children, value } = props;
    return <ArtCreationContext.Provider value={value}>
        {children}
    </ArtCreationContext.Provider>;
};
