import React from "react";
import { Text } from "react-native";
import { fonts, responsiveFontSize } from "../../theme/tokens";

/**
 * Typo — the tenant app's universal text primitive.
 * Maps `weight` (100–900) to the loaded Nunito family.
 * `size` is responsive: scales with screen width (ref 350px) and OS font scale.
 */
export default function Typo({
  children,
  size = 14,
  weight = 600,
  color,
  center,
  mt,
  mb,
  ml,
  mr,
  style,
  letterSpacing,
  uppercase,
  allowFontScaling = true,
  ...props
}) {
  const family = fonts[weight] || fonts[800];
  return (
    <Text
      {...props}
      allowFontScaling={allowFontScaling}
      style={[
        {
          fontFamily: family,
          fontSize: responsiveFontSize(size),
          color,
          textAlign: center ? "center" : undefined,
          marginTop: mt,
          marginBottom: mb,
          marginLeft: ml,
          marginRight: mr,
          letterSpacing,
          textTransform: uppercase ? "uppercase" : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
