import SwiftUI

struct PlacePreviewSheet: View {
    let place: PlaceSummary
    let onViewDetails: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WICSpacing.medium) {
                previewHeader
                location
                status
                actions
            }
            .padding(.horizontal, WICSpacing.comfortable)
            .padding(.top, WICSpacing.small)
            .padding(.bottom, WICSpacing.large)
        }
        .scrollIndicators(.hidden)
        .modifier(
            PlacePreviewDetentsModifier(
                startsExpanded: dynamicTypeSize.isAccessibilitySize
            )
        )
        .presentationDragIndicator(.visible)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("place.preview")
    }

    private var previewHeader: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: WICSpacing.small) {
                    HStack(alignment: .top) {
                        PlaceIdentityBadge(place: place, size: 56)
                        Spacer(minLength: 0)
                        closeButton
                    }
                    identityText
                }
            } else {
                HStack(alignment: .top, spacing: WICSpacing.compact) {
                    PlaceIdentityBadge(place: place, size: 56)
                    identityText
                    Spacer(minLength: 0)
                    closeButton
                }
            }
        }
    }

    private var identityText: some View {
        VStack(alignment: .leading, spacing: WICSpacing.compact) {
            Text(place.categoryLabel)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.wicSecondaryText)
                .textCase(.uppercase)

            Text(place.name)
                .font(.title3.weight(.bold))
                .foregroundStyle(.wicPrimaryText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("place.preview.name")

            WorkRatingView(rating: place.rating, labelStyle: .compact)
                .accessibilityIdentifier("place.preview.rating")
        }
    }

    private var closeButton: some View {
        Button("Close", systemImage: "xmark") {
            dismiss()
        }
        .labelStyle(.iconOnly)
        .font(.body.weight(.semibold))
        .frame(
            width: WICSpacing.minimumControlTarget,
            height: WICSpacing.minimumControlTarget
        )
        .background(.wicSurface, in: Circle())
        .accessibilityIdentifier("place.close")
    }

    @ViewBuilder
    private var location: some View {
        if !place.neighborhood.isEmpty || !place.address.isEmpty {
            HStack(alignment: .top, spacing: WICSpacing.small) {
                Image(systemName: "mappin.and.ellipse")
                    .foregroundStyle(.wicAccent)

                VStack(alignment: .leading, spacing: 2) {
                    if !place.neighborhood.isEmpty {
                        Text(place.neighborhood)
                            .font(.subheadline.weight(.semibold))
                    }
                    if !place.address.isEmpty {
                        Text(place.address)
                            .font(.footnote)
                            .foregroundStyle(.wicSecondaryText)
                    }
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("place.preview.location")
        }
    }

    @ViewBuilder
    private var status: some View {
        if place.isValidated || hasMembership {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: WICSpacing.small) {
                        statusItems
                    }
                } else {
                    HStack(spacing: WICSpacing.small) {
                        statusItems
                    }
                }
            }
            .font(.caption.weight(.semibold))
        }
    }

    @ViewBuilder
    private var statusItems: some View {
        if place.isValidated {
            Label("Validated", systemImage: "checkmark.seal.fill")
                .foregroundStyle(.wicPositive)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("place.preview.status.validated")
        }

        if let membership = nonemptyMembership {
            Label(membership, systemImage: "person.badge.key.fill")
                .foregroundStyle(.wicSecondaryText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("place.preview.status.membership")
        }
    }

    private var actions: some View {
        VStack(spacing: WICSpacing.small) {
            Button(action: onViewDetails) {
                Label("View work spot", systemImage: "arrow.up.right")
                    .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("place.preview.details")

            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(spacing: WICSpacing.small) {
                        secondaryActions
                    }
                } else {
                    HStack(spacing: WICSpacing.small) {
                        secondaryActions
                    }
                }
            }
        }
        .controlSize(.large)
    }

    @ViewBuilder
    private var secondaryActions: some View {
        Button {
            // Authentication and persistence arrive in a later product slice.
        } label: {
            Label("Save", systemImage: "bookmark")
                .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
        }
        .buttonStyle(.bordered)
        .disabled(true)
        .accessibilityHint("Sign in support is coming in the authenticated product slice")
        .accessibilityIdentifier("place.preview.save")

        Button {
            AppleMapsDirections.open(place: place)
        } label: {
            Label("Directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
        }
        .buttonStyle(.bordered)
        .accessibilityHint("Opens this destination in Apple Maps")
        .accessibilityIdentifier("place.preview.directions")
    }

    private var nonemptyMembership: String? {
        guard let membership = place.membershipRequired?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              !membership.isEmpty else { return nil }
        return membership
    }

    private var hasMembership: Bool {
        nonemptyMembership != nil
    }
}

private struct PlacePreviewDetentsModifier: ViewModifier {
    let startsExpanded: Bool
    @State private var selection: PresentationDetent

    init(startsExpanded: Bool) {
        self.startsExpanded = startsExpanded
        _selection = State(initialValue: startsExpanded ? .large : .medium)
    }

    func body(content: Content) -> some View {
        content.presentationDetents(detents, selection: $selection)
    }

    private var detents: Set<PresentationDetent> {
        startsExpanded ? [.large] : [.height(310), .medium, .large]
    }
}
