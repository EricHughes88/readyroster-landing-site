import NotificationsPage from "../../../components/notifications/NotificationsPage";

export default function ParentNotificationsRoute() {
  return (
    <NotificationsPage
      roleLabel="Parent"
      dashboardHref="/parent"
    />
  );
}