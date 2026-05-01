import { BottomTabNavigationOptions, BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Descriptor, ParamListBase, RouteProp } from "@react-navigation/native";

export type BottomTabDescriptor = Descriptor<
  BottomTabNavigationOptions,
  BottomTabNavigationProp<ParamListBase>,
  RouteProp<ParamListBase>
>;

