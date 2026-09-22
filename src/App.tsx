import { ConfigProvider, Layout, message, theme, type ThemeConfig } from "antd";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";
import { useAppSelector } from "./app/hooks.ts";
import Navbar from "./components/Navbar.tsx";
import Sidebar from "./components/Sidebar.tsx";
import type { CustomerLocation } from "./types/customerLocation.types.ts";
import type { CustomerProduct } from "./types/customerProduct.types.ts";
import Login from "./pages/Login.tsx";
import AppRouter from "./router/index.tsx";
import { login, logout, fetchCountries } from "./store/appSlice.ts";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "./app/store";
import { fetchAccessorials } from "./store/accessorialsSlice";
import { saveCustomerProduct } from "./store/customerProductSlice.ts";
import { saveCustomerLocation } from "./store/customerLocationSlice.ts";

const { Content } = Layout;

const antTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#d71920",
    colorInfo: "#d71920",
    borderRadius: 6,
    fontFamily: '"Geist", sans-serif',
  },
  components: {
    Layout: {
      headerBg: "#ffffff",
      bodyBg: "#f4f4f5",
      siderBg: "#080808",
    },
    Menu: {
      darkItemBg: "#080808",
      darkItemColor: "#8e8e8e",
      darkItemHoverBg: "#1f1f1f",
      darkItemSelectedBg: "#2c2a2a",
      darkItemSelectedColor: "#ffffff",
    },
  },
};

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const isAuthenticated = useAppSelector((state) => state.app.isAuthenticated);
  const [customerLocations, setCustomerLocations] = useState<
    CustomerLocation[]
  >([]);
  const [customerProducts, setCustomerProducts] = useState<CustomerProduct[]>([]);
  const [messageApi, messageContext] = message.useMessage();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const reduxCustomerLocations = useAppSelector(
    (state) => state.customerLocation?.locations ?? []
  );
  const reduxCustomerProducts = useAppSelector(
    (state) => state.customerProduct?.products ?? []
  );

  useEffect(() => {
    setCustomerLocations(reduxCustomerLocations);
  }, [reduxCustomerLocations]);

  useEffect(() => {
    setCustomerProducts(reduxCustomerProducts);
  }, [reduxCustomerProducts]);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchAccessorials());
      dispatch(fetchCountries());
    }
  }, [isAuthenticated, dispatch]);

  const handleLogout = () => {
    dispatch(logout());
    setCollapsed(false);
    navigate("/", { replace: true });
  };

  const handleLogin = () => {
    dispatch(login());
    navigate("/shipments", { replace: true });
  };

  const handleCreateLocation = async (values: Omit<CustomerLocation, "key">) => {
    try {
      await dispatch(saveCustomerLocation(values)).unwrap();
      navigate("/customer-location");
      messageApi.success("Location added successfully");
    } catch (error) {
      messageApi.error(`API Error: ${error}`);
    }
  };

  const handleCreateProduct = async (values: Omit<CustomerProduct, "key">) => {
    try {
      await dispatch(saveCustomerProduct(values)).unwrap();
      navigate("/customer-products");
      messageApi.success("Product saved and added successfully");
    } catch (error) {
      messageApi.error(`API Error: ${error}`);
    }
  };

  return (
    <ConfigProvider theme={antTheme}>
      {messageContext}
      {!isAuthenticated ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Layout className='shipment-shell'>
          <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />

          <Layout className='main-layout'>
            <Navbar
              collapsed={collapsed}
              onToggleSidebar={() => setCollapsed((value) => !value)}
              onLogout={handleLogout}
            />

            <Content className='app-content'>
              <AppRouter
                customerLocations={customerLocations}
                setCustomerLocations={setCustomerLocations}
                customerProducts={customerProducts}
                setCustomerProducts={setCustomerProducts}
                onCreateLocation={handleCreateLocation}
                onCreateProduct={handleCreateProduct}
              />
            </Content>
          </Layout>
        </Layout>
      )}
    </ConfigProvider>
  );
}

export default App;
