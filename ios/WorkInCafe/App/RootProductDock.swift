import SwiftUI

struct RootProductDock: View {
    @Binding var selection: ProductMode

    var body: some View {
        HStack(spacing: WICSpacing.small) {
            ForEach(ProductMode.allCases, id: \.self) { mode in
                Button {
                    selection = mode
                } label: {
                    dockItem(for: mode)
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(mode.title)
                .accessibilityValue(selection == mode ? "Selected" : "Not selected")
                .accessibilityAddTraits(selection == mode ? .isSelected : [])
            }
        }
        .padding(.horizontal, WICSpacing.small)
        .padding(.vertical, 6)
        .background(.regularMaterial, in: Capsule())
        .overlay {
            Capsule()
                .stroke(.wicSurfaceBorder, lineWidth: 0.5)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("product.dock")
    }

    private func dockItem(for mode: ProductMode) -> some View {
        let isSelected = selection == mode
        return VStack(spacing: 3) {
            Image(systemName: mode.symbolName)
                .symbolVariant(isSelected ? .fill : .none)
                .font(.system(size: 17, weight: isSelected ? .semibold : .regular))
                .frame(height: 20)

            Text(mode.title)
                .font(.caption2.weight(isSelected ? .semibold : .regular))
                .lineLimit(1)

            Capsule()
                .fill(isSelected ? Color.wicAccent : .clear)
                .frame(width: 18, height: 2)
        }
        .foregroundStyle(isSelected ? .wicAccent : .wicSecondaryText)
        .frame(minWidth: 72, minHeight: WICSpacing.minimumControlTarget)
        .contentShape(Rectangle())
    }
}

private extension ProductMode {
    var title: String {
        switch self {
        case .profile: "Profile"
        case .workSpots: "Work spots"
        case .cowork: "Cowork"
        }
    }

    var symbolName: String {
        switch self {
        case .profile: "person.crop.circle"
        case .workSpots: "mappin.and.ellipse"
        case .cowork: "person.2"
        }
    }
}
