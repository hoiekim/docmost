import { Center, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

/**
 * Placeholder for a route that only exists in the enterprise build. Reachable
 * only by typing the URL, since every link to one of these pages is behind an
 * entitlement the CE server does not report.
 */
export default function FeatureNotAvailable() {
  const { t } = useTranslation();
  return (
    <Center h="60vh">
      <Stack align="center" gap="xs">
        <Title order={3}>{t("Not available in this edition")}</Title>
        <Text c="dimmed" size="sm">
          {t("This page is part of the enterprise edition.")}
        </Text>
      </Stack>
    </Center>
  );
}
