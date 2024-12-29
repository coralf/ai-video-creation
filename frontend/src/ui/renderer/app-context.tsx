import React, { createContext, useContext } from 'react';
import { MessageInstance } from 'antd/es/message/interface';

export const AppContext = createContext(null);


export const AppContextProvider = (props: { children: React.ReactElement; value: any; }) => {
    const { children, value } = props;
    return <AppContext.Provider value={value}>
        {children}
    </AppContext.Provider>;
};

export const useAppContext = () => {
    return useContext(AppContext);
};