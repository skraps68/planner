import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { configureStore } from '@reduxjs/toolkit'
import theme from '../theme'
import authReducer from '../store/slices/authSlice'
import uiReducer from '../store/slices/uiSlice'

// Create a test store with initial state
export const createTestStore = (preloadedState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
    },
    preloadedState,
  })
}

// Create a test query client
export const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

interface AllTheProvidersProps {
  children: React.ReactNode
  store?: ReturnType<typeof createTestStore>
  queryClient?: QueryClient
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ 
  children, 
  store = createTestStore(),
  queryClient = createTestQueryClient()
}) => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            {children}
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  store?: ReturnType<typeof createTestStore>
  queryClient?: QueryClient
}

const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  const { store, queryClient, ...renderOptions } = options || {}
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders store={store} queryClient={queryClient}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  })
}

export * from '@testing-library/react'
export { customRender as render }
