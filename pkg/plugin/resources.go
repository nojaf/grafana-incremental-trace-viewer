package plugin

type ServerInterfaceImpl struct{}

func mkServerInterface() ServerInterface {
	return &ServerInterfaceImpl{}
}
